import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  // Verify caller is authenticated and is admin_sistema
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: caller } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin_sistema") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { full_name, email, password, role } = await request.json();

  if (!full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Campos incompletos" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create auth user without sending confirmation email
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true, // skip email confirmation
  });

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? "Error al crear usuario" }, { status: 500 });
  }

  // Insert into app_users
  const { error: dbErr } = await admin.from("app_users").insert({
    id:        authData.user.id,
    full_name: full_name.trim(),
    email:     email.trim(),
    role,
    is_active: true,
  });

  if (dbErr) {
    // Rollback auth user
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
