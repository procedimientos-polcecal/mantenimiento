import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PlanificacionClient from "./PlanificacionClient";

export default async function PlanificacionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  const canEdit = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  const admin = createAdminClient();
  const { data: plans } = await admin
    .from("daily_plans")
    .select("*, created_by_user:created_by(full_name), daily_plan_items(id)")
    .order("fecha", { ascending: false })
    .limit(30);

  return <PlanificacionClient plans={plans ?? []} canEdit={canEdit} />;
}
