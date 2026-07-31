import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/work-orders/orden — guarda el orden manual de un conjunto de OTs
// Body: { items: [{ id, orden }] }
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { items } = await request.json();
  if (!Array.isArray(items)) return NextResponse.json({ error: "items requerido" }, { status: 400 });

  const admin = createAdminClient();
  await Promise.all(
    items
      .filter((it: any) => it?.id)
      .map((it: any) =>
        admin.from("work_orders").update({ orden_manual: Number(it.orden) || 0 }).eq("id", it.id)
      )
  );
  return NextResponse.json({ success: true });
}
