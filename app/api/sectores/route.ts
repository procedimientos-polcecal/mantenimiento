import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdminSistema() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const { data: caller } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin_sistema") {
    return { error: NextResponse.json({ error: "Solo administrador de sistema" }, { status: 403 }) };
  }
  return { error: null };
}

// PATCH /api/sectores — renombrar un sector
export async function PATCH(request: Request) {
  const { error: authErr } = await requireAdminSistema();
  if (authErr) return authErr;

  const { id, name } = await request.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: "Sector y nombre son requeridos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("sectors").update({ name: name.trim() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST /api/sectores — crear un sector
export async function POST(request: Request) {
  const { error: authErr } = await requireAdminSistema();
  if (authErr) return authErr;

  const { name, plant_id } = await request.json();
  if (!name?.trim() || !plant_id) {
    return NextResponse.json({ error: "Nombre y planta son requeridos" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sectors").insert({ name: name.trim(), plant_id }).select("id, name, plant_id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
