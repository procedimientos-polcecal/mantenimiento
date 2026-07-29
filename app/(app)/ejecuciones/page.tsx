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

  const [{ data: workOrders }, { data: executions }] = await Promise.all([
    // OTs pendientes (no realizadas) sobre las que registrar una ejecución
    supabase
      .from("work_orders")
      .select("id, ot_number, descripcion, estado, equipo_raw, equipo_code, equipment_id, sector_raw")
      .neq("estado", "REALIZADO")
      .order("ot_number", { ascending: false })
      .limit(100),
    // Ejecuciones recientes (con OT o, si es vieja, con programado)
    supabase
      .from("maintenance_executions")
      .select("*, work_order:work_order_id(ot_number, descripcion, equipo_raw), schedule:schedule_id(maintenance_type, equipment(name, code)), executor:executed_by(full_name)")
      .order("executed_at", { ascending: false })
      .limit(50),
  ]);

  const canExecute = appUser?.role !== null;

  return (
    <EjecucionesClient
      workOrders={workOrders ?? []}
      executions={executions ?? []}
      currentUserId={user.id}
      canExecute={canExecute}
    />
  );
}
