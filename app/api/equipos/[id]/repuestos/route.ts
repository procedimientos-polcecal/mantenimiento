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

// GET — lista de repuestos del equipo (cualquier autenticado)
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("equipment_parts").select("*").eq("equipment_id", id).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — agregar repuesto
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { name, code, notes } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("equipment_parts")
    .insert({ equipment_id: id, name: name.trim(), code: code?.trim() || null, notes: notes?.trim() || null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH — editar repuesto
export async function PATCH(request: Request) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { part_id, name, code, notes } = await request.json();
  if (!part_id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const admin = createAdminClient();
  const payload: any = {};
  if (name?.trim()) payload.name = name.trim();
  if (code !== undefined) payload.code = code?.trim() || null;
  if (notes !== undefined) payload.notes = notes?.trim() || null;

  const { error } = await admin.from("equipment_parts").update(payload).eq("id", part_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — eliminar repuesto (?part_id=...)
export async function DELETE(request: Request) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const partId = new URL(request.url).searchParams.get("part_id");
  if (!partId) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("equipment_parts").delete().eq("id", partId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
