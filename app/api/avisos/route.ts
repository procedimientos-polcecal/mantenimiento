import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Google Sheets (hoja de AVISOS) ───────────────────────────────────────────
const AVISOS_SHEET_ID = process.env.GOOGLE_SHEETS_AVISOS_ID ?? "";
const AVISOS_TAB      = process.env.GOOGLE_SHEETS_AVISOS_TAB ?? "AVISOS";

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurado");
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

// Máximo N° OA ("A###") presente en la columna A de la hoja
async function getMaxOaFromSheet(token: string): Promise<number> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${AVISOS_SHEET_ID}/values/${encodeURIComponent(AVISOS_TAB)}!A2:A`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Avisos Sheets read ${res.status}: ${await res.text()}`);
  const json = await res.json();
  let maxN = 0;
  for (const row of (json.values ?? []) as string[][]) {
    const m = (row[0] ?? "").toString().trim().match(/^A(\d+)$/i);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
  return maxN;
}

function isoToLocaleDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR");
}

// Agrega una fila al final de la hoja de avisos; devuelve el nº de fila
async function appendAvisoRow(token: string, aviso: any): Promise<number | null> {
  const row = [
    aviso.oa_number,                 // A  N° OA
    isoToLocaleDate(aviso.fecha),    // B  Fecha
    aviso.sector_raw ?? "",          // C  Sector
    aviso.equipo_raw ?? "",          // D  Equipo
    aviso.descripcion ?? "",         // E  Descripción
    aviso.urgencia ?? "",            // F  Urgencia
    aviso.quien_aviso ?? "",         // G  Quién avisó
    "",                              // H  (Column 10)
    "",                              // I  (Column 11)
    "",                              // J  OT ASIGNADA (vacía)
    aviso.observaciones ?? "",       // K  Observaciones
  ];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${AVISOS_SHEET_ID}/values/${encodeURIComponent(AVISOS_TAB)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`Avisos Sheets append ${res.status}: ${JSON.stringify(d)}`);
  const range: string = d.updates?.updatedRange ?? "";
  const m = range.match(/(\d+)(?::[A-Z]+\d+)?$/);
  return m ? Number(m[1]) : null;
}

// GET /api/avisos — listar avisos
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const urgencia = searchParams.get("urgencia");
  const search   = searchParams.get("q");
  const sinOt    = searchParams.get("sin_ot"); // solo avisos sin OT asignada
  const page     = Number(searchParams.get("page") ?? 1);
  const limit    = 50;

  const admin = createAdminClient();
  let query = admin
    .from("avisos")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("oa_number", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (urgencia) query = query.ilike("urgencia", `%${urgencia}%`);
  if (sinOt) {
    // Sin OT: sin work_order_id y sin ot_asignada (null o vacía)
    query = query.is("work_order_id", null).or("ot_asignada.is.null,ot_asignada.eq.");
  }
  if (search) {
    const safe = search.replace(/[,()*\\%]/g, "").trim();
    if (safe) query = query.or(`descripcion.ilike.%${safe}%,equipo_raw.ilike.%${safe}%,sector_raw.ilike.%${safe}%,oa_number.ilike.%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

// POST /api/avisos — crear aviso desde la app
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const { equipment_id, sector_id, sector_raw, equipo_raw, equipo_code,
          descripcion, urgencia, quien_aviso, observaciones, reference_photos, repuesto } = body;

  if (!descripcion?.trim()) {
    return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Próximo N° OA: leído del MÁXIMO de la planilla de avisos ──────────────
  // (si la hoja no está disponible, se cae al máximo de la base como respaldo)
  let token: string | null = null;
  let maxN = 0;
  try {
    if (AVISOS_SHEET_ID) {
      token = await getAccessToken();
      maxN = await getMaxOaFromSheet(token);
    }
  } catch (e) {
    console.error("No se pudo leer N° OA de la hoja:", e);
    token = null;
  }
  if (maxN === 0) {
    // Respaldo: máximo en la base
    const { data: last } = await admin
      .from("avisos").select("oa_number").ilike("oa_number", "A%")
      .order("created_at", { ascending: false }).limit(500);
    for (const r of last ?? []) {
      const m = (r.oa_number ?? "").match(/^A(\d+)$/i);
      if (m) maxN = Math.max(maxN, Number(m[1]));
    }
  }
  const oa_number = `A${maxN + 1}`;

  const record: any = {
    oa_number,
    fecha:        new Date().toISOString().slice(0, 10),
    sector_id:    sector_id || null,
    sector_raw:   sector_raw || null,
    equipo_raw:   equipo_raw || null,
    equipo_code:  equipo_code || null,
    equipment_id: equipment_id || null,
    descripcion:  descripcion.trim(),
    urgencia:     urgencia || null,
    quien_aviso:  quien_aviso || null,
    observaciones: observaciones?.trim() || null,
    repuesto:     repuesto?.trim() || null,
    reference_photos: Array.isArray(reference_photos) && reference_photos.length ? reference_photos : null,
    app_created:  true,
    created_by:   user.id,
    synced_at:    new Date().toISOString(),
  };

  const { data: inserted, error } = await admin.from("avisos").insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Escribir el aviso como fila nueva en la planilla ──────────────────────
  let sheets_written = false;
  try {
    if (token && AVISOS_SHEET_ID) {
      const sheetsRow = await appendAvisoRow(token, inserted);
      if (sheetsRow) {
        await admin.from("avisos").update({ sheets_row: sheetsRow }).eq("id", inserted.id);
        inserted.sheets_row = sheetsRow;
        sheets_written = true;
      }
    }
  } catch (e) {
    console.error("No se pudo escribir el aviso en la hoja:", e);
  }

  return NextResponse.json({ data: inserted, oa_number, sheets_written });
}
