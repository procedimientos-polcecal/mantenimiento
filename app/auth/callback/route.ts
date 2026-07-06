import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Solo se permite el ingreso con Google de cuentas de este dominio.
const ALLOWED_DOMAIN = "polcecal.com";
// Rol por defecto para usuarios nuevos (el admin lo ajusta después).
const DEFAULT_ROLE = "operario";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const { data: { user } } = await supabase.auth.getUser();
  const email = (user?.email ?? "").toLowerCase();

  // Restricción de dominio
  if (!user || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // Alta automática en app_users la primera vez (sin pisar el rol si ya existe)
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("app_users").select("id, is_active").eq("id", user.id).maybeSingle();

  if (!existing) {
    await admin.from("app_users").insert({
      id:        user.id,
      email,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? email.split("@")[0],
      role:      DEFAULT_ROLE,
      is_active: true,
    });
  } else if (existing.is_active === false) {
    // Usuario dado de baja: no lo dejamos entrar
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=inactive`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
