import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MantenimientosClient from "./MantenimientosClient";

export default async function MantenimientosPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .single();

  const [{ data: schedules }, { data: equipment }, { data: users }, { data: linkedOts }] = await Promise.all([
    supabase
      .from("maintenance_schedules")
      .select("*, equipment(id, name, code, sector_id, sectors(name, plants(name))), assigned_user:assigned_to(full_name)")
      .order("next_date", { ascending: true }),
    supabase
      .from("equipment")
      .select("id, name, code, sector_id, sectors(name, plants(name))")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("app_users")
      .select("id, full_name, role")
      .eq("is_active", true)
      .order("full_name"),
    supabase
      .from("work_orders")
      .select("id, ot_number, estado, descripcion, schedule_id")
      .not("schedule_id", "is", null)
      .order("ot_number", { ascending: false }),
  ]);

  const canEdit =
    appUser?.role === "admin_sistema" || appUser?.role === "administrador";

  return (
    <MantenimientosClient
      schedules={schedules ?? []}
      equipment={equipment ?? []}
      users={users ?? []}
      linkedOts={linkedOts ?? []}
      canEdit={canEdit}
      currentUserId={user.id}
    />
  );
}
