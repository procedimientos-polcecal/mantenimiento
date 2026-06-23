import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getCallerRole(supabase: any, userId: string) {
  const { data } = await supabase.from("app_users").select("role").eq("id", userId).single();
  return data?.role ?? null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const role = await getCallerRole(supabase, user.id);
  if (role !== "admin_sistema") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { full_name, email, password, role: newRole } = await request.json();
  if (!full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Campos incompletos" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? "Error al crear usuario" }, { status: 500 });
  }

  const { error: dbErr } = await admin.from("app_users").insert({
    id:        authData.user.id,
    full_name: full_name.trim(),
    email:     email.trim(),
    role:      newRole,
    is_active: true,
  });

  if (dbErr) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const callerRole = await getCallerRole(supabase, user.id);
  if (!["admin_sistema", "administrador"].includes(callerRole)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id, full_name, role, password } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const admin = createAdminClient();
  const errors: string[] = [];

  // Update app_users table
  const dbPayload: any = {};
  if (full_name?.trim()) dbPayload.full_name = full_name.trim();
  if (role) dbPayload.role = role;

  if (Object.keys(dbPayload).length > 0) {
    const { error } = await admin.from("app_users").update(dbPayload).eq("id", id);
    if (error) errors.push(error.message);
  }

  // Update password in auth if provided
  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) errors.push(error.message);
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
