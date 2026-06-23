import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: appUser },
    { data: equipment },
    { data: upcoming },
    { data: overdue },
    { data: plants },
    { data: sectors },
    { data: plantStatusLog },
    { data: recentExecutions },
  ] = await Promise.all([
    supabase.from("app_users").select("*").eq("id", user.id).single(),
    supabase.from("equipment")
      .select("status, criticality, sectors(name, plants(name))")
      .eq("is_active", true),
    supabase.from("maintenance_schedules")
      .select("*, equipment(name, code), assigned_user:assigned_to(full_name)")
      .eq("status", "active")
      .lte("next_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0])
      .gte("next_date", new Date().toISOString().split("T")[0])
      .order("next_date", { ascending: true })
      .limit(10),
    supabase.from("maintenance_schedules")
      .select("*, equipment(name, code), assigned_user:assigned_to(full_name)")
      .eq("status", "active")
      .lt("next_date", new Date().toISOString().split("T")[0])
      .order("next_date", { ascending: true })
      .limit(10),
    supabase.from("plants").select("id, name, status").order("name"),
    supabase.from("sectors").select("name, plants(name)").order("name"),
    supabase.from("plant_status_log")
      .select("*, plant:plant_id(name), changed_by_user:changed_by(full_name)")
      .order("changed_at", { ascending: false })
      .limit(20),
    supabase.from("maintenance_executions")
      .select("execution_status, executed_at")
      .order("executed_at", { ascending: false })
      .limit(60),
  ]);

  const canEdit = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  return (
    <DashboardClient
      appUser={appUser}
      equipment={equipment ?? []}
      upcoming={upcoming ?? []}
      overdue={overdue ?? []}
      plants={plants ?? []}
      sectors={sectors ?? []}
      plantStatusLog={plantStatusLog ?? []}
      recentExecutions={recentExecutions ?? []}
      canEdit={canEdit}
    />
  );
}
