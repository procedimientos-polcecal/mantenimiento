import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estado       = searchParams.get("estado");
  const equipment_id = searchParams.get("equipment_id");
  const search       = searchParams.get("q");
  const page         = Number(searchParams.get("page") ?? 1);
  const limit        = 50;

  const admin = createAdminClient();
  let query = admin
    .from("work_orders")
    .select("*", { count: "exact" })
    .order("ot_number", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (estado)       query = query.eq("estado", estado);
  if (equipment_id) query = query.eq("equipment_id", equipment_id);
  if (search)       query = query.or(`descripcion.ilike.%${search}%,equipo_raw.ilike.%${search}%,sector_raw.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count });
}

// ── POST: create OT from app ─────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: caller } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const {
    equipment_id, sector_id, sector_raw, equipo_raw, equipo_code,
    especialidad, tipo, quien, descripcion, repuesto,
    fecha, fecha_ejecucion, fecha_cierre,
    estado, contratista, horas, operario_1, operario_2, operario_3, prioridad,
  } = body;

  if (!descripcion?.trim()) {
    return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get next OT number
  const { data: last } = await admin
    .from("work_orders").select("ot_number").order("ot_number", { ascending: false }).limit(1).single();
  const ot_number = (last?.ot_number ?? 0) + 1;

  const record = {
    ot_number,
    fecha:           fecha || new Date().toISOString().slice(0, 10),
    sector_id:       sector_id || null,
    sector_raw:      sector_raw || null,
    equipo_raw:      equipo_raw || null,
    equipo_code:     equipo_code || null,
    equipment_id:    equipment_id || null,
    especialidad:    especialidad || null,
    tipo:            tipo || null,
    quien:           quien || null,
    descripcion:     descripcion.trim(),
    repuesto:        repuesto?.trim() || null,
    fecha_ejecucion: fecha_ejecucion || null,
    fecha_cierre:    fecha_cierre || null,
    estado:          estado || "POR_HACER",
    contratista:     contratista?.trim() || null,
    horas:           horas ? Number(horas) : null,
    operario_1:      operario_1?.trim() || null,
    operario_2:      operario_2?.trim() || null,
    operario_3:      operario_3?.trim() || null,
    prioridad:       prioridad || null,
    app_created:     true,
    created_by:      user.id,
    created_at_app:  new Date().toISOString(),
    synced_at:       new Date().toISOString(),
  };

  const { data: inserted, error } = await admin
    .from("work_orders").insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write-back to Google Sheets (best-effort — no credentials yet)
  let sheets_written = false;
  try {
    const sheetsRow = await appendToSheet(inserted);
    if (sheetsRow) {
      await admin.from("work_orders")
        .update({ sheets_row: sheetsRow })
        .eq("id", inserted.id);
      sheets_written = true;
    }
  } catch (e) {
    // Credentials not configured — silently skip
  }

  return NextResponse.json({ data: inserted, sheets_written, ot_number });
}

// ── PATCH: update OT estado from app ────────────────────────────────────────
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id, estado, ...rest } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const admin = createAdminClient();
  const update: any = { synced_at: new Date().toISOString() };
  if (estado) update.estado = estado;
  Object.assign(update, rest);

  const { data: updated, error } = await admin
    .from("work_orders").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update Sheets row if we know which row it is
  if (updated.sheets_row && estado) {
    try { await updateSheetRow(updated); } catch (_) { /* no credentials yet */ }
  }

  return NextResponse.json({ data: updated });
}

// ── Sheets write helpers (stubs until JSON is configured) ────────────────────

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) throw new Error("No credentials");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const pemBody = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8", Buffer.from(pemBody, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, Buffer.from(unsigned));
  const jwt = `${unsigned}.${Buffer.from(sig).toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(JSON.stringify(d));
  return d.access_token;
}

function isoToExcelDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR");
}

function otToRow(ot: any): string[] {
  return [
    String(ot.ot_number),
    isoToExcelDate(ot.fecha),
    ot.sector_raw ?? "",
    ot.equipo_raw ?? "",
    ot.especialidad ?? "",
    ot.tipo ?? "",
    ot.quien ?? "",
    ot.descripcion ?? "",
    ot.repuesto ?? "",
    isoToExcelDate(ot.fecha_ejecucion),
    isoToExcelDate(ot.fecha_cierre),
    "",
    ot.estado ?? "",
    ot.contratista ?? "",
    ot.horas != null ? String(ot.horas) : "",
    ot.operario_1 ?? "",
    ot.operario_2 ?? "",
    ot.operario_3 ?? "",
    ot.prioridad ?? "",
  ];
}

async function appendToSheet(ot: any): Promise<number | null> {
  const SHEET_ID  = process.env.GOOGLE_SHEETS_ID ?? "";
  const TAB       = process.env.GOOGLE_SHEETS_TAB ?? "OT";
  if (!SHEET_ID) return null;
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TAB)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [otToRow(ot)] }),
  });
  const d = await res.json();
  const range: string = d.updates?.updatedRange ?? "";
  const match = range.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function updateSheetRow(ot: any): Promise<void> {
  const SHEET_ID = process.env.GOOGLE_SHEETS_ID ?? "";
  const TAB      = process.env.GOOGLE_SHEETS_TAB ?? "OT";
  if (!SHEET_ID || !ot.sheets_row) return;
  const token = await getAccessToken();
  const range = `${TAB}!A${ot.sheets_row}:S${ot.sheets_row}`;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [otToRow(ot)] }),
    }
  );
}
