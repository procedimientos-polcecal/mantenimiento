import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EjecucionesClient from "./EjecucionesClient";

export default async function EjecucionesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .single();

  const [{ data: schedules }, { data: executions }] = await Promise.all([
    supabase
      .from("maintenance_schedules")
      .select("id, maintenance_type, schedule_type, next_date, description, estimated_hours, equipment(id, name, code, sectors(name, plants(name))), assigned_user:assigned_to(id, full_name)")
      .eq("status", "active")
      .order("next_date", { ascending: true }),
    supabase
      .from("maintenance_executions")
      .select("*, schedule:schedule_id(maintenance_type, equipment(name, code)), executor:executed_by(full_name)")
      .order("executed_at", { ascending: false })
      .limit(50),
  ]);

  const canExecute = appUser?.role !== null;

  return (
    <EjecucionesClient
      schedules={schedules ?? []}
      executions={executions ?? []}
      currentUserId={user.id}
      canExecute={canExecute}
    />
  );
}
