import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const WEBHOOK_SECRET = process.env.SHEETS_WEBHOOK_SECRET ?? "";

function excelDateToISO(val: string | number | undefined): string | null {
  if (!val) return null;
  const n = Number(val);
  if (isNaN(n) || n < 1) return null;
  return new Date((n - 25569) * 86400 * 1000).toISOString().slice(0, 10);
}

function extractCode(raw: string): string | null {
  if (!raw) return null;
  const match = raw.match(/^([A-Z]{2}-[A-Z0-9]+-\d+)/);
  return match ? match[1] : null;
}

function normalizeEstado(val: string): string {
  const v = (val ?? "").trim().toUpperCase();
  if (v === "REALIZADO")     return "REALIZADO";
  if (v.includes("PROCESO")) return "EN_PROCESO";
  if (v === "ATRASADO")      return "ATRASADO";
  if (v === "SUSPENDIDA")    return "SUSPENDIDA";
  return "POR_HACER";
}

// POST /api/work-orders/webhook
// Called by Google Apps Script onEdit trigger
export async function POST(request: Request) {
  // Validate secret token — falla CERRADO: si el secreto no está configurado,
  // rechazamos todo en vez de dejar el endpoint abierto.
  if (!WEBHOOK_SECRET) {
    console.error("SHEETS_WEBHOOK_SECRET no configurado — webhook deshabilitado");
    return NextResponse.json({ error: "Webhook no configurado" }, { status: 503 });
  }
  const secret = request.headers.get("x-webhook-secret") ?? "";
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { row, data: rowData } = body as { row: number; data: string[] };

  if (!row || !rowData || rowData.length < 1) {
    return NextResponse.json({ error: "Missing row data" }, { status: 400 });
  }

  const otNum = Number(rowData[0]);
  if (!otNum || isNaN(otNum)) {
    return NextResponse.json({ error: "Invalid OT number" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Build lookup maps
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
    ot_number:       otNum,
    fecha:           excelDateToISO(rowData[1]),
    sector_raw:      sectorRaw || null,
    sector_id:       equipEntry?.sector_id ?? sectorNameMap.get(sectorRaw.toLowerCase()) ?? null,
    equipo_raw:      equipoRaw || null,
    equipo_code:     equipoCode,
    equipment_id:    equipEntry?.id ?? null,
    especialidad:    rowData[4] ?? null,
    tipo:            rowData[5] ?? null,
    quien:           rowData[6] ?? null,
    descripcion:     rowData[7] ?? null,
    repuesto:        rowData[8] ?? null,
    fecha_ejecucion: excelDateToISO(rowData[9]),
    fecha_cierre:    excelDateToISO(rowData[10]),
    estado:          normalizeEstado(rowData[12] ?? ""),
    contratista:     rowData[13] ?? null,
    horas:           rowData[14] ? Number(rowData[14]) || null : null,
    operario_1:      rowData[15] ?? null,
    operario_2:      rowData[16] ?? null,
    operario_3:      rowData[17] ?? null,
    prioridad:       rowData[18] ?? null,
    frecuencia:      rowData[19] || null,           // T
    proxima_fecha:   excelDateToISO(rowData[20]),   // U
    sheets_row:      row,
    synced_at:       new Date().toISOString(),
  };

  const { error } = await admin
    .from("work_orders")
    .upsert(record, { onConflict: "ot_number" });

  if (error) {
    console.error("Webhook upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ot_number: otNum });
}
