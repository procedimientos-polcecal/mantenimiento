import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// GET — lista (cualquier autenticado), ordenada por slot y nombre
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("operarios").select("*").order("slot").order("nombre");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — crear { slot, nombre }
export async function POST(request: Request) {
  const { error: authErr } = await requireAdminSistema();
  if (authErr) return authErr;
  const { slot, nombre } = await request.json();
  const slotNum = Number(slot);
  if (![1, 2, 3].includes(slotNum)) return NextResponse.json({ error: "Posición inválida (1, 2 o 3)" }, { status: 400 });
  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("operarios").insert({ slot: slotNum, nombre: nombre.trim() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE ?id=...
export async function DELETE(request: Request) {
  const { error: authErr } = await requireAdminSistema();
  if (authErr) return authErr;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("operarios").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
