import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const WEBHOOK_SECRET = process.env.AVISOS_WEBHOOK_SECRET ?? "";

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

// POST /api/avisos/webhook — llamado por Apps Script al editar la hoja de avisos
export async function POST(request: Request) {
  // Falla cerrado si no está configurado el secreto
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }
  if ((request.headers.get("x-webhook-secret") ?? "") !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { row, data: rowData } = (await request.json()) as { row: number; data: string[] };
  if (!row || !rowData || rowData.length < 1) {
    return NextResponse.json({ error: "Missing row data" }, { status: 400 });
  }
  const oa = (rowData[0] ?? "").toString().trim();
  if (!oa) return NextResponse.json({ error: "Falta N° OA" }, { status: 400 });

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

  const equipoRaw  = (rowData[3] ?? "").toString().trim();
  const equipoCode = extractCode(equipoRaw);
  const equipEntry = equipoCode ? codeMap.get(equipoCode) : null;
  const sectorRaw  = (rowData[2] ?? "").toString().trim();

  const record = {
    oa_number:    oa,
    fecha:        excelDateToISO(rowData[1]),
    sector_raw:   sectorRaw || null,
    sector_id:    equipEntry?.sector_id ?? sectorNameMap.get(sectorRaw.toLowerCase()) ?? null,
    equipo_raw:   equipoRaw || null,
    equipo_code:  equipoCode,
    equipment_id: equipEntry?.id ?? null,
    descripcion:  rowData[4] ?? null,
    urgencia:     rowData[5] ?? null,
    quien_aviso:  rowData[6] ?? null,
    ot_asignada:  (rowData[9] ?? "").toString().trim() || null,
    observaciones: rowData[10] ?? null,
    sheets_row:   row,
    synced_at:    new Date().toISOString(),
  };

  const { error } = await admin.from("avisos").upsert(record, { onConflict: "oa_number" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, oa_number: oa });
}
