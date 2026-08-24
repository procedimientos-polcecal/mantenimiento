import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OS_TABS, OS_HEADER_ALIASES, osNorm } from "@/lib/sheets-sync";

const SHEET_ID = process.env.GOOGLE_SHEETS_OS_ID ?? "";

// GET /api/ordenes-servicio — listar
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const area   = searchParams.get("area");
  const estado = searchParams.get("estado");
  const search = searchParams.get("q");
  const page   = Number(searchParams.get("page") ?? 1);
  const limit  = 50;

  const admin = createAdminClient();
  let query = admin.from("ordenes_servicio").select("*", { count: "exact" })
    .order("os_number", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (area)   query = query.eq("area", area);
  if (estado) query = query.ilike("estado", `%${estado}%`);
  if (search) {
    const safe = search.replace(/[,()*\\%]/g, "").trim();
    if (safe) query = query.or(`descripcion.ilike.%${safe}%,equipo_raw.ilike.%${safe}%,sector_raw.ilike.%${safe}%,proveedor_elegido.ilike.%${safe}%`);
  }
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

// ── Google Sheets (escritura) ────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurado");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Buffer.from(pem, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, Buffer.from(unsigned));
  const jwt = `${unsigned}.${Buffer.from(sig).toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(JSON.stringify(d));
  return d.access_token;
}

function tabForArea(area: string): string {
  const n = osNorm(area);
  return OS_TABS.find((t) => osNorm(t) === n) ?? "OTRA";
}

function colLetter(i: number): string {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// PATCH /api/ordenes-servicio — cambiar estado y/o fechas de seguimiento
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  // Whitelist de campos editables + su clave de columna en la planilla.
  const update: any = { synced_at: new Date().toISOString() };
  const sheetWrites: { key: string; value: string }[] = [];
  if (body.estado !== undefined) {
    const v = (body.estado ?? "").toString().trim() || null;
    update.estado = v;
    sheetWrites.push({ key: "estado", value: v ?? "" });
  }
  if (body.fecha_pedido !== undefined) {
    update.fecha_pedido = body.fecha_pedido || null;
    sheetWrites.push({ key: "fecha_pedido", value: isoToARDate(body.fecha_pedido) });
  }
  if (body.fecha_realizacion !== undefined) {
    update.fecha_realizacion = body.fecha_realizacion || null;
    sheetWrites.push({ key: "fecha_realizacion", value: isoToARDate(body.fecha_realizacion) });
  }
  if (body.proveedor_elegido !== undefined) {
    const v = (body.proveedor_elegido ?? "").toString().trim() || null;
    update.proveedor_elegido = v;
    sheetWrites.push({ key: "proveedor_elegido", value: v ?? "" });
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("ordenes_servicio").update(update).eq("id", body.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write-back a la planilla: cada campo a su columna (por encabezado), best-effort.
  let sheets_error: string | null = null;
  try {
    if (SHEET_ID && updated.sheets_tab && updated.sheets_row) {
      const token = await getAccessToken();
      const hr = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(updated.sheets_tab)}!1:1`,
        { headers: { Authorization: `Bearer ${token}` } });
      const header: string[] = ((await hr.json()).values?.[0] ?? []).map(osNorm);
      const data: { range: string; values: string[][] }[] = [];
      for (const w of sheetWrites) {
        const col = header.findIndex((h) => (OS_HEADER_ALIASES[w.key] ?? []).some((a) => osNorm(a) === h));
        if (col >= 0) {
          data.push({ range: `${encodeURIComponent(updated.sheets_tab)}!${colLetter(col)}${updated.sheets_row}`, values: [[w.value]] });
        }
      }
      if (data.length > 0) {
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate`,
          { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) });
        if (!res.ok) sheets_error = `Sheets ${res.status}`;
      }
    }
  } catch (e: any) { sheets_error = e.message; }

  return NextResponse.json({ data: updated, sheets_error });
}

function isoToARDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso.toString().slice(0, 10) + "T12:00:00").toLocaleDateString("es-AR");
}

// POST /api/ordenes-servicio — crear OS (y agregarla a la planilla)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const b = await request.json();
  if (!b.descripcion?.trim()) return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
  if (!b.area?.trim()) return NextResponse.json({ error: "El área es requerida" }, { status: 400 });

  const admin = createAdminClient();

  // Próximo N° OS
  const { data: last } = await admin.from("ordenes_servicio").select("os_number").order("os_number", { ascending: false }).limit(1).single();
  const os_number = (last?.os_number ?? 0) + 1;

  // Resolver equipo/sector
  const equipoRaw = (b.equipo_raw ?? "").toString().trim();
  const codeMatch = equipoRaw.match(/^([A-Z]{2}-[A-Z0-9]+-\d+)/);
  const equipo_code = codeMatch ? codeMatch[1] : null;
  let equipment_id = null, sector_id = b.sector_id || null;
  if (equipo_code) {
    const { data: eq } = await admin.from("equipment").select("id, sector_id").eq("code", equipo_code).maybeSingle();
    if (eq) { equipment_id = eq.id; sector_id = sector_id ?? eq.sector_id; }
  }

  // Las OS nuevas se cargan en la hoja maestra SERVICIOS (después se filtran por área)
  const tab = "SERVICIOS";
  const record: any = {
    os_number, fecha: new Date().toISOString().slice(0, 10),
    area: b.area.trim(), sector_raw: b.sector_raw?.trim() || null, sector_id,
    equipo_raw: equipoRaw || null, equipo_code, equipment_id,
    descripcion: b.descripcion.trim(),
    detalle_extra: b.detalle_extra?.trim() || null,
    prioridad: b.prioridad || null, empresa: b.empresa || null,
    proveedor_elegido: b.proveedor_elegido?.trim() || null,
    estado: b.estado?.trim() || "PENDIENTE",
    observaciones: b.observaciones?.trim() || null,
    app_created: true, sheets_tab: tab, created_by: user.id, synced_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await admin.from("ordenes_servicio").insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agregar fila a la planilla (best-effort), respetando el orden de columnas de la pestaña
  let sheets_written = false;
  try {
    if (SHEET_ID) {
      const token = await getAccessToken();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tab)}!1:1`;
      const hr = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const hj = await hr.json();
      const header: string[] = (hj.values?.[0] ?? []).map(osNorm);

      // valor por clave interna
      const valueFor: Record<string, any> = {
        os_number, fecha: new Date().toLocaleDateString("es-AR"),
        area: record.area, sector_raw: record.sector_raw ?? "", equipo_raw: record.equipo_raw ?? "",
        descripcion: record.descripcion, detalle_extra: record.detalle_extra ?? "",
        prioridad: record.prioridad ?? "", empresa: record.empresa ?? "",
        proveedor_elegido: record.proveedor_elegido ?? "", estado: record.estado ?? "",
        observaciones: record.observaciones ?? "",
      };
      const row = header.map((h) => {
        for (const key of Object.keys(OS_HEADER_ALIASES)) {
          if (OS_HEADER_ALIASES[key].some((a) => osNorm(a) === h)) return valueFor[key] ?? "";
        }
        return "";
      });
      // La 1ª columna es siempre el N° OS (en SERVICIOS el encabezado viene raro)
      if (row.length > 0) row[0] = os_number;
      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ values: [row] }) }
      );
      const aj = await appendRes.json();
      const range: string = aj.updates?.updatedRange ?? "";
      const m = range.match(/(\d+)(?::[A-Z]+\d+)?$/);
      if (m) { await admin.from("ordenes_servicio").update({ sheets_row: Number(m[1]) }).eq("id", inserted.id); sheets_written = true; }
    }
  } catch (e) {
    console.error("OS sheet append error:", e);
  }

  return NextResponse.json({ data: inserted, os_number, sheets_written });
}
