import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProduccionClient from "./ProduccionClient";

export default async function ProduccionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  // Editan: administrador de sistema y jefe de producción
  const canEdit = ["admin_sistema", "jefe_produccion"].includes(appUser?.role ?? "");

  const [{ data: sectors }, { data: otPend }, { data: osRows }] = await Promise.all([
    supabase.from("sectors").select("id, name, plant_id, plants(name)").order("name"),
    // OT pendientes (no realizadas) con sector, para cruzar con las ventanas libres
    supabase.from("work_orders")
      .select("sector_id, ot_number, descripcion, equipo_raw, estado, prioridad")
      .in("estado", ["POR_HACER", "EN_PROCESO", "ATRASADO"])
      .not("sector_id", "is", null),
    // OS con sector (se filtran las activas del lado del cliente)
    supabase.from("ordenes_servicio")
      .select("sector_id, os_number, descripcion, estado")
      .not("sector_id", "is", null),
  ]);

  // OS activas = no denegadas/anuladas
  const osPend = (osRows ?? []).filter((o: any) => {
    const e = (o.estado ?? "").toLowerCase();
    return !e.includes("deneg") && !e.includes("rechaz") && !e.includes("anul");
  });

  return <ProduccionClient sectors={sectors ?? []} canEdit={canEdit} pendOT={otPend ?? []} pendOS={osPend} />;
}
