import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrdenesServicioClient from "./OrdenesServicioClient";

export default async function OrdenesServicioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  const role = appUser?.role ?? "";
  const canEdit = ["admin_sistema", "administrador"].includes(role);

  const { data: equipment } = await supabase
    .from("equipment").select("id, name, code, sector_id, sectors(name)").eq("is_active", true).order("code");

  return <OrdenesServicioClient equipment={equipment ?? []} canEdit={canEdit} canSync={canEdit} />;
}
