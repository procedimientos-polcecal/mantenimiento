import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return { error: NextResponse.json({ error: "Sin permisos" }, { status: 403 }) };
  }
  return { error: null };
}

// GET — componentes del equipo
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("equipment_components").select("*").eq("equipment_id", id).order("nombre");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — agregar componente
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  const b = await request.json();
  if (!b.nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("equipment_components").insert({
    equipment_id: id,
    nombre: b.nombre.trim(),
    categoria: b.categoria?.trim() || null,
    especificacion: b.especificacion?.trim() || null,
    material: b.material?.trim() || null,
    cantidad: b.cantidad?.trim() || null,
    proveedor_critico: b.proveedor_critico?.trim() || null,
    criticidad: b.criticidad?.trim() || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — eliminar componente (?comp_id=...)
export async function DELETE(request: Request) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  const compId = new URL(request.url).searchParams.get("comp_id");
  if (!compId) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("equipment_components").delete().eq("id", compId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
