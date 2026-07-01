import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PlanDetalle from "./PlanDetalle";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  const canEdit = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  const admin = createAdminClient();
  const [{ data: plan }, { data: pendingOTs }, { data: appUsers }, { data: sectors }] = await Promise.all([
    admin.from("daily_plans")
      .select("*, created_by_user:created_by(full_name), daily_plan_items(*, assigned_user:assigned_to(full_name))")
      .eq("id", id).single(),
    // OTs pending (not REALIZADO)
    admin.from("work_orders")
      .select("id, ot_number, especialidad, sector_raw, equipo_raw, descripcion, repuesto, fecha_ejecucion, estado, sector_id")
      .in("estado", ["POR_HACER", "EN_PROCESO", "ATRASADO"])
      .order("ot_number", { ascending: false })
      .limit(300),
    admin.from("app_users").select("id, full_name").eq("is_active", true).order("full_name"),
    admin.from("sectors").select("id, name, plants(name)").order("name"),
  ]);

  if (!plan) notFound();

  return (
    <PlanDetalle
      plan={plan}
      pendingOTs={pendingOTs ?? []}
      appUsers={appUsers ?? []}
      sectors={sectors ?? []}
      canEdit={canEdit}
    />
  );
}
