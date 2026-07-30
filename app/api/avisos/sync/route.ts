import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAvisosSync } from "@/lib/sheets-sync";

// POST /api/avisos/sync — sincronización manual (admin)
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  try {
    const synced = await runAvisosSync();
    return NextResponse.json({ synced });
  } catch (err: any) {
    console.error("Avisos sync error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/avisos/sync — última sincronización
export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin.from("avisos").select("synced_at")
    .order("synced_at", { ascending: false }).limit(1).single();
  return NextResponse.json({ last_sync: data?.synced_at ?? null });
}
