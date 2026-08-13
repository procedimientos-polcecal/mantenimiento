import { createAdminClient } from "@/lib/supabase/admin";

// ── Auth Google (lectura) ────────────────────────────────────────────────────
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

async function fetchSheet(sheetId: string, tab: string): Promise<string[][]> {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.values ?? []) as string[][];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function normalizeEstado(val: string): string {
  const v = (val ?? "").trim().toUpperCase();
  if (v === "REALIZADO")     return "REALIZADO";
  if (v.includes("PROCESO")) return "EN_PROCESO";
  if (v === "ATRASADO")      return "ATRASADO";
  if (v === "SUSPENDIDA")    return "SUSPENDIDA";
  return "POR_HACER";
}

async function buildMaps() {
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
  return { admin, codeMap, sectorNameMap };
}

// ── Sync OTs ───────────────────────────────────────────────────────────────────
export async function runWorkOrdersSync(): Promise<number> {
  const SHEET_ID = process.env.GOOGLE_SHEETS_ID ?? "";
  const TAB      = process.env.GOOGLE_SHEETS_TAB ?? "OT";
  if (!SHEET_ID) throw new Error("GOOGLE_SHEETS_ID no configurado");

  const rows = await fetchSheet(SHEET_ID, TAB);
  if (rows.length < 2) return 0;

  const { admin, codeMap, sectorNameMap } = await buildMaps();
  const body = rows.slice(1);
  const records: any[] = [];

  for (let i = 0; i < body.length; i++) {
    const row = body[i];
    const otNum = Number(row[0]);
    if (!otNum || isNaN(otNum)) continue;

    const equipoRaw  = (row[3] ?? "").toString().trim();
    const equipoCode = extractCode(equipoRaw);
    const equipEntry = equipoCode ? codeMap.get(equipoCode) : null;
    const sectorRaw  = (row[2] ?? "").toString().trim();

    records.push({
      ot_number:       otNum,
      fecha:           excelDateToISO(row[1]),
      sector_raw:      sectorRaw || null,
      sector_id:       equipEntry?.sector_id ?? sectorNameMap.get(sectorRaw.toLowerCase()) ?? null,
      equipo_raw:      equipoRaw || null,
      equipo_code:     equipoCode,
      equipment_id:    equipEntry?.id ?? null,
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
      frecuencia:      row[19] || null,
      proxima_fecha:   excelDateToISO(row[20]),
      sheets_row:      i + 2,
      synced_at:       new Date().toISOString(),
    });
  }

  let synced = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const { error } = await admin.from("work_orders").upsert(batch, { onConflict: "ot_number" });
    if (error) throw error;
    synced += batch.length;
  }
  return synced;
}

// ── Sync Avisos ─────────────────────────────────────────────────────────────────
export async function runAvisosSync(): Promise<number> {
  const SHEET_ID = process.env.GOOGLE_SHEETS_AVISOS_ID ?? "";
  const TAB      = process.env.GOOGLE_SHEETS_AVISOS_TAB ?? "AVISOS";
  if (!SHEET_ID) throw new Error("GOOGLE_SHEETS_AVISOS_ID no configurado");

  const rows = await fetchSheet(SHEET_ID, TAB);
  if (rows.length < 2) return 0;

  const { admin, codeMap, sectorNameMap } = await buildMaps();
  const body = rows.slice(1);
  const records: any[] = [];

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

  let synced = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const { error } = await admin.from("avisos").upsert(batch, { onConflict: "oa_number" });
    if (error) throw error;
    synced += batch.length;
  }
  return synced;
}

// ── Sync Órdenes de Servicio (múltiples pestañas por área) ──────────────────────
// SERVICIOS es la hoja maestra (llegan todas las OS); las de área la enriquecen.
export const OS_TABS = [
  "SERVICIOS",
  "MANTENIMIENTO", "TALLER VIAL", "PRODUCCIÓN", "LABORATORIO",
  "ALMACÉN", "INVERSIONES", "DESPACHO", "CANTERA", "OTRA",
];

export const osNorm = (s: any) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().toUpperCase().replace(/\./g, "").replace(/\s+/g, " ");
const norm = osNorm;

// Alias de encabezados → clave interna
export const OS_HEADER_ALIASES: Record<string, string[]> = {
  os_number:           ["N OS", "N° OS", "NRO OS", "N  OS"],
  fecha:               ["FECHA"],
  area:                ["AREA"],
  sector_raw:          ["SECTOR"],
  equipo_raw:          ["EQUIPO"],
  descripcion:         ["DESCRIPCION"],
  fecha_requerimiento: ["FECHA DE REQ", "FECHA DE REQUERIMIENTO"],
  detalle_extra:       ["DETALLE EXTRA"],
  imagen:              ["IMAGEN"],
  prioridad:           ["PRIORIDAD"],
  empresa:             ["EMPRESA"],
  comparativa:         ["COMPARATIVA"],
  proveedor_elegido:   ["PROVEEDOR ELEGIDO"],
  estado:              ["ESTADO"],
  cuit:                ["CUIT"],
  tiene_orden_compra:  ["TIENE ORDEN DE COMPRA"],
  costo:               ["COSTO SIN IVA", "COSTO + IVA", "COSTO"],
  fecha_realizacion:   ["FECHA DE REALIZACION"],
  observaciones:       ["OBSERVACIONES EXTRA", "OBSERVACIONES"],
};

export async function runOrdenesServicioSync(): Promise<number> {
  const SHEET_ID = process.env.GOOGLE_SHEETS_OS_ID ?? "";
  if (!SHEET_ID) throw new Error("GOOGLE_SHEETS_OS_ID no configurado");

  const { admin, codeMap, sectorNameMap } = await buildMaps();
  const records: any[] = [];

  for (const tab of OS_TABS) {
    let rows: string[][];
    try { rows = await fetchSheet(SHEET_ID, tab); }
    catch { continue; } // pestaña inexistente → se ignora
    if (rows.length < 2) continue;

    // Mapa clave interna → índice de columna, según el encabezado de esta pestaña
    const header = rows[0].map(norm);
    const colOf = (key: string) => {
      for (const alias of OS_HEADER_ALIASES[key]) {
        const i = header.indexOf(norm(alias));
        if (i >= 0) return i;
      }
      return -1;
    };
    const idx: Record<string, number> = {};
    for (const key of Object.keys(OS_HEADER_ALIASES)) idx[key] = colOf(key);
    // En todas estas hojas la 1ª columna es el N° OS (en SERVICIOS el encabezado
    // viene raro), así que si no se detectó por nombre, se usa la columna 0.
    if (idx.os_number < 0) idx.os_number = 0;

    const val = (row: string[], key: string) => {
      const i = idx[key];
      return i >= 0 ? row[i] : undefined;
    };

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const osNum = Number(val(row, "os_number"));
      if (!osNum || isNaN(osNum)) continue;

      const equipoRaw  = (val(row, "equipo_raw") ?? "").toString().trim();
      const equipoCode = extractCode(equipoRaw);
      const equipEntry = equipoCode ? codeMap.get(equipoCode) : null;
      const sectorRaw  = (val(row, "sector_raw") ?? "").toString().trim();
      const costoRaw   = val(row, "costo");

      records.push({
        os_number:          osNum,
        fecha:              excelDateToISO(val(row, "fecha")),
        area:               (val(row, "area") ?? "").toString().trim() || tab,
        sector_raw:         sectorRaw || null,
        sector_id:          equipEntry?.sector_id ?? sectorNameMap.get(sectorRaw.toLowerCase()) ?? null,
        equipo_raw:         equipoRaw || null,
        equipo_code:        equipoCode,
        equipment_id:       equipEntry?.id ?? null,
        descripcion:        val(row, "descripcion") ?? null,
        fecha_requerimiento: excelDateToISO(val(row, "fecha_requerimiento")),
        detalle_extra:      val(row, "detalle_extra") ?? null,
        imagen:             val(row, "imagen") ?? null,
        prioridad:          val(row, "prioridad") ?? null,
        empresa:            val(row, "empresa") ?? null,
        comparativa:        val(row, "comparativa") ?? null,
        proveedor_elegido:  val(row, "proveedor_elegido") ?? null,
        estado:             val(row, "estado") ?? null,
        cuit:               (val(row, "cuit") ?? "").toString().trim() || null,
        tiene_orden_compra: (val(row, "tiene_orden_compra") ?? "").toString().trim() || null,
        costo:              costoRaw ? Number(costoRaw) || null : null,
        fecha_realizacion:  excelDateToISO(val(row, "fecha_realizacion")),
        observaciones:      val(row, "observaciones") ?? null,
        sheets_tab:         tab,
        sheets_row:         r + 1,
        synced_at:          new Date().toISOString(),
      });
    }
  }

  // Deduplicar por os_number (si aparece en más de una pestaña, gana la última)
  const byNum = new Map<number, any>();
  for (const rec of records) byNum.set(rec.os_number, rec);
  const deduped = [...byNum.values()];

  let synced = 0;
  for (let i = 0; i < deduped.length; i += 500) {
    const batch = deduped.slice(i, i + 500);
    const { error } = await admin.from("ordenes_servicio").upsert(batch, { onConflict: "os_number" });
    if (error) throw error;
    synced += batch.length;
  }
  return synced;
}
