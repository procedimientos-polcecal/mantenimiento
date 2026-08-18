import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  matchComparativaTab, appendComparativaRow,
  updateComparativaEleccion, clearComparativaRow,
} from "@/lib/sheets-sync";

async function requireEdit() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) };
  }
  return { error: null };
}

// GET ?os_number=... — cotizaciones de una OS (cualquier autenticado)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const osNumber = new URL(request.url).searchParams.get("os_number");
  if (!osNumber) return NextResponse.json({ error: "os_number requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("os_comparativas")
    .select("*").eq("os_number", Number(osNumber))
    .order("sheets_tab").order("sheets_row");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — agregar una cotización (append a la planilla + espejo)
export async function POST(request: Request) {
  const { error: authErr } = await requireEdit();
  if (authErr) return authErr;
  const body = await request.json();
  const osNumber = Number(body.os_number);
  if (!osNumber || isNaN(osNumber)) return NextResponse.json({ error: "os_number requerido" }, { status: 400 });
  if (!body.proveedor?.trim()) return NextResponse.json({ error: "El proveedor es requerido" }, { status: 400 });

  const admin = createAdminClient();
  // Datos de la OS para autocompletar area/sector/equipo/descripción.
  const { data: os } = await admin.from("ordenes_servicio")
    .select("area, sector_raw, equipo_raw, descripcion, fecha").eq("os_number", osNumber).single();

  const sector = (body.sector ?? os?.sector_raw ?? "").toString().trim() || "Otros";
  const tab = matchComparativaTab(sector);

  const record: any = {
    os_number:              osNumber,
    fecha:                  body.fecha ?? new Date().toISOString().slice(0, 10),
    area:                   os?.area ?? null,
    sector,
    equipo_raw:             os?.equipo_raw ?? null,
    descripcion:            (body.descripcion ?? os?.descripcion ?? null),
    proveedor:              body.proveedor.trim(),
    precio_unitario:        body.precio_unitario?.toString().trim() || null,
    iva:                    body.iva === "" || body.iva == null ? null : Number(body.iva),
    precio_total:           body.precio_total?.toString().trim() || null,
    vigencia_hasta:         body.vigencia_hasta || null,
    plazos:                 body.plazos?.toString().trim() || null,
    condiciones_pago:       body.condiciones_pago?.toString().trim() || null,
    otras_especificaciones: body.otras_especificaciones?.toString().trim() || null,
    eleccion:               !!body.eleccion,
  };

  // 1) Escribir en la planilla (fuente de verdad) y obtener el nº de fila.
  let sheetsRow: number | null = null;
  try {
    sheetsRow = await appendComparativaRow(tab, record);
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo escribir en la planilla: ${e.message}` }, { status: 502 });
  }

  // 2) Espejo en Supabase.
  const { data, error } = await admin.from("os_comparativas")
    .insert({ ...record, sheets_tab: tab, sheets_row: sheetsRow, synced_at: new Date().toISOString() })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH — marcar/desmarcar elegido { id, eleccion }
export async function PATCH(request: Request) {
  const { error: authErr } = await requireEdit();
  if (authErr) return authErr;
  const { id, eleccion } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { data: row } = await admin.from("os_comparativas")
    .select("sheets_tab, sheets_row").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (row.sheets_tab && row.sheets_row) {
    try { await updateComparativaEleccion(row.sheets_tab, row.sheets_row, !!eleccion); }
    catch (e: any) { return NextResponse.json({ error: `No se pudo escribir en la planilla: ${e.message}` }, { status: 502 }); }
  }
  const { error } = await admin.from("os_comparativas").update({ eleccion: !!eleccion }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE ?id=... — borra la cotización (limpia la fila en la planilla + espejo)
export async function DELETE(request: Request) {
  const { error: authErr } = await requireEdit();
  if (authErr) return authErr;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { data: row } = await admin.from("os_comparativas")
    .select("sheets_tab, sheets_row").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (row.sheets_tab && row.sheets_row) {
    try { await clearComparativaRow(row.sheets_tab, row.sheets_row); }
    catch (e: any) { return NextResponse.json({ error: `No se pudo escribir en la planilla: ${e.message}` }, { status: 502 }); }
  }
  const { error } = await admin.from("os_comparativas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
