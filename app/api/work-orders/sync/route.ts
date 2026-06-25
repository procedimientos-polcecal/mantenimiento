import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Google Sheets helpers ────────────────────────────────────────────────────

const SHEET_ID   = process.env.GOOGLE_SHEETS_ID ?? "";
const SHEET_NAME = process.env.GOOGLE_SHEETS_TAB ?? "OT"; // nombre de la hoja

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
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Import private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryKey = Buffer.from(pemBody, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(unsigned)
  );

  const jwt = `${unsigned}.${Buffer.from(sig).toString("base64url")}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(JSON.stringify(tokenData));
  return tokenData.access_token;
}

async function fetchSheet(): Promise<string[][]> {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return (json.values ?? []) as string[][];
}

// ── Excel serial date → ISO string ──────────────────────────────────────────
function excelDateToISO(val: string | number | undefined): string | null {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n < 1) return null;
  const ms = (n - 25569) * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

// ── Extract equipment code from "PO-A1-07 – Rompedora de cono" ──────────────
function extractCode(raw: string): string | null {
  if (!raw) return null;
  const match = raw.match(/^([A-Z]{2}-[A-Z0-9]+-\d+)/);
  return match ? match[1] : null;
}

// ── Normalize estado ─────────────────────────────────────────────────────────
function normalizeEstado(val: string): string {
  const v = (val ?? "").trim().toUpperCase();
  if (v === "REALIZADO")               return "REALIZADO";
  if (v.includes("PROCESO"))           return "EN_PROCESO";
  if (v === "ATRASADO")                return "ATRASADO";
  return "POR_HACER";
}

// ── POST /api/work-orders/sync ───────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: caller } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  if (!SHEET_ID) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_ID no configurado" }, { status: 500 });
  }

  try {
    const rows = await fetchSheet();
    if (rows.length < 2) return NextResponse.json({ synced: 0 });

    // Header row: N° OT | FECHA | SECTOR | EQUIPO | ESPECIALIDAD | TIPO DE TRABAJO |
    //             QUIÉN LO REALIZA | DESCRIPCIÓN | REPUESTO | FECHA EJECUCIÓN |
    //             FECHA CIERRE | (delay col) | ESTADO | CONTRATISTA | HORAS |
    //             OPERARIO 1 | OPERARIO 2 | OPERARIO 3 | PRIORIDAD

    const admin = createAdminClient();

    // Build equipment code → id map for fast lookup
    const { data: equipmentList } = await admin
      .from("equipment").select("id, code");
    const codeMap = new Map<string, string>(
      (equipmentList ?? []).map((e: any) => [e.code, e.id])
    );

    const records: any[] = [];

    for (const row of rows.slice(1)) {
      const otNum = Number(row[0]);
      if (!otNum || isNaN(otNum)) continue;

      const equipoRaw  = (row[3] ?? "").toString().trim();
      const equipoCode = extractCode(equipoRaw);
      const equipmentId = equipoCode ? (codeMap.get(equipoCode) ?? null) : null;

      records.push({
        ot_number:       otNum,
        fecha:           excelDateToISO(row[1]),
        sector_raw:      row[2] ?? null,
        equipo_raw:      equipoRaw || null,
        equipo_code:     equipoCode,
        equipment_id:    equipmentId,
        especialidad:    row[4] ?? null,
        tipo:            row[5] ?? null,
        quien:           row[6] ?? null,
        descripcion:     row[7] ?? null,
        repuesto:        row[8] ?? null,
        fecha_ejecucion: excelDateToISO(row[9]),
        fecha_cierre:    excelDateToISO(row[10]),
        estado:          normalizeEstado(row[12] ?? ""),
        contratista:     row[13] ?? null,
        horas:           row[14] ? Number(row[14]) || null : null,
        operario_1:      row[15] ?? null,
        operario_2:      row[16] ?? null,
        operario_3:      row[17] ?? null,
        prioridad:       row[18] ?? null,
        synced_at:       new Date().toISOString(),
      });
    }

    if (records.length === 0) return NextResponse.json({ synced: 0 });

    // Upsert in batches of 500
    let synced = 0;
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      const { error } = await admin
        .from("work_orders")
        .upsert(batch, { onConflict: "ot_number" });
      if (error) throw error;
      synced += batch.length;
    }

    return NextResponse.json({ synced });
  } catch (err: any) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── GET /api/work-orders/sync — last sync info ───────────────────────────────
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("work_orders")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();
  return NextResponse.json({ last_sync: data?.synced_at ?? null });
}
