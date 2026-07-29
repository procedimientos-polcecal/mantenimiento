import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Hoja de AVISOS (archivo de Google Sheets aparte del de OTs)
const SHEET_ID   = process.env.GOOGLE_SHEETS_AVISOS_ID ?? "";
const SHEET_NAME = process.env.GOOGLE_SHEETS_AVISOS_TAB ?? "AVISOS";

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurado");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
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

async function fetchSheet(): Promise<string[][]> {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.values ?? []) as string[][];
}

function excelDateToISO(val: string | number | undefined): string | null {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n < 1) return null;
  return new Date((n - 25569) * 86400 * 1000).toISOString().slice(0, 10);
}

function extractCode(raw: string): string | null {
  if (!raw) return null;
  const m = raw.match(/^([A-Z]{2}-[A-Z0-9]+-\d+)/);
  return m ? m[1] : null;
}

// POST /api/avisos/sync — trae los avisos desde la hoja
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  if (!SHEET_ID) return NextResponse.json({ error: "GOOGLE_SHEETS_AVISOS_ID no configurado" }, { status: 500 });

  try {
    const rows = await fetchSheet();
    if (rows.length < 2) return NextResponse.json({ synced: 0 });

    const admin = createAdminClient();
    const [{ data: equipmentList }, { data: sectorList }] = await Promise.all([
      admin.from("equipment").select("id, code, sector_id"),
      admin.from("sectors").select("id, name"),
    ]);
    const codeMap = new Map<string, { id: string; sector_id: string }>(
      (equipmentList ?? []).map((e: any) => [e.code, { id: e.id, sector_id: e.sector_id }])
    );
    const sectorNameMap = new Map<string, string>(
      (sectorList ?? []).map((s: any) => [s.name.toLowerCase().trim(), s.id])
    );

    // Header: N° OA | FECHA | SECTOR | EQUIPO | DESCRIPCIÓN | URGENCIA |
    //         QUIÉN AVISÓ | (nombre) | (apellido) | OT ASIGNADA | Observaciones
    const records: any[] = [];
    const body = rows.slice(1);
    for (let i = 0; i < body.length; i++) {
      const row = body[i];
      const oa = (row[0] ?? "").toString().trim();
      if (!oa) continue;

      const equipoRaw  = (row[3] ?? "").toString().trim();
      const equipoCode = extractCode(equipoRaw);
      const equipEntry = equipoCode ? codeMap.get(equipoCode) : null;
      const sectorRaw  = (row[2] ?? "").toString().trim();

      records.push({
        oa_number:    oa,
        fecha:        excelDateToISO(row[1]),
        sector_raw:   sectorRaw || null,
        sector_id:    equipEntry?.sector_id ?? sectorNameMap.get(sectorRaw.toLowerCase()) ?? null,
        equipo_raw:   equipoRaw || null,
        equipo_code:  equipoCode,
        equipment_id: equipEntry?.id ?? null,
        descripcion:  row[4] ?? null,
        urgencia:     row[5] ?? null,
        quien_aviso:  row[6] ?? null,
        ot_asignada:  (row[9] ?? "").toString().trim() || null,
        observaciones:row[10] ?? null,
        sheets_row:   i + 2,
        synced_at:    new Date().toISOString(),
      });
    }

    if (records.length === 0) return NextResponse.json({ synced: 0 });

    let synced = 0;
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      const { error } = await admin.from("avisos").upsert(batch, { onConflict: "oa_number" });
      if (error) throw error;
      synced += batch.length;
    }
    return NextResponse.json({ synced });
  } catch (err: any) {
    console.error("Avisos sync error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/avisos/sync — última sincronización
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin.from("avisos").select("synced_at")
    .order("synced_at", { ascending: false }).limit(1).single();
  return NextResponse.json({ last_sync: data?.synced_at ?? null });
}
