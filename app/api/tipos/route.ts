import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Campos editables del tipo de equipo
const FIELDS = [
  "categoria", "nombre_tipo", "descripcion_funcion", "accionamiento",
  "potencia_kw_tipica", "tension_v", "velocidad_rpm_tipica", "tiene_reductor",
  "relacion_reduccion", "tipo_correa", "cant_correas",
  "rodamiento_lado_motor", "rodamiento_lado_carga", "rodamiento_intermedio",
  "lubricante_tipo", "lubricante_marca_ref", "frecuencia_lubricacion",
  "freq_inspeccion_visual", "freq_lubricacion", "freq_revision_mayor", "notas_tecnicas",
];

async function requireAdminSistema() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin_sistema") {
    return { error: NextResponse.json({ error: "Solo administrador de sistema" }, { status: 403 }) };
  }
  return { error: null };
}

function pick(body: any) {
  const rec: any = {};
  for (const k of FIELDS) if (k in body) rec[k] = (body[k] ?? "").toString().trim() || null;
  return rec;
}

// GET — lista de tipos (cualquier autenticado)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("equipment_types").select("*").order("nombre_tipo");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — crear tipo
export async function POST(request: Request) {
  const { error: authErr } = await requireAdminSistema();
  if (authErr) return authErr;
  const body = await request.json();
  const tipo_id = (body.tipo_id ?? "").toString().trim().toUpperCase();
  if (!tipo_id || !body.nombre_tipo?.trim()) {
    return NextResponse.json({ error: "Código (tipo_id) y nombre son requeridos" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("equipment_types").insert({ tipo_id, ...pick(body) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH — editar tipo
export async function PATCH(request: Request) {
  const { error: authErr } = await requireAdminSistema();
  if (authErr) return authErr;
  const body = await request.json();
  const tipo_id = (body.tipo_id ?? "").toString().trim();
  if (!tipo_id) return NextResponse.json({ error: "tipo_id requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("equipment_types").update(pick(body)).eq("tipo_id", tipo_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — eliminar tipo (?tipo_id=...)
export async function DELETE(request: Request) {
  const { error: authErr } = await requireAdminSistema();
  if (authErr) return authErr;
  const tipoId = new URL(request.url).searchParams.get("tipo_id");
  if (!tipoId) return NextResponse.json({ error: "tipo_id requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("equipment_types").delete().eq("tipo_id", tipoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
