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

  const [{ data: schedules }, { data: equipment }, { data: users }] = await Promise.all([
    supabase
      .from("maintenance_schedules")
      .select("*, equipment(id, name, code, sectors(name, plants(name))), assigned_user:assigned_to(full_name)")
      .order("next_date", { ascending: true }),
    supabase
      .from("equipment")
      .select("id, name, code, sectors(name, plants(name))")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("app_users")
      .select("id, full_name, role")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const canEdit =
    appUser?.role === "admin_sistema" || appUser?.role === "administrador";

  return (
    <MantenimientosClient
      schedules={schedules ?? []}
      equipment={equipment ?? []}
      users={users ?? []}
      canEdit={canEdit}
      currentUserId={user.id}
    />
  );
}
