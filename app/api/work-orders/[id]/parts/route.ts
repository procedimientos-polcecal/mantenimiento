import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

// GET — repuestos necesarios de la OT
export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("work_order_parts").select("*").eq("work_order_id", id).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — agregar repuesto necesario
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { nombre, codigo, cantidad } = await request.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("work_order_parts").insert({
    work_order_id: id, nombre: nombre.trim(),
    codigo: codigo?.trim() || null, cantidad: cantidad?.toString().trim() || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE ?part_id=... — quitar repuesto necesario
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const partId = new URL(request.url).searchParams.get("part_id");
  if (!partId) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("work_order_parts").delete().eq("id", partId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
