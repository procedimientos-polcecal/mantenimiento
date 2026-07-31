import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProduccionClient from "./ProduccionClient";

export default async function ProduccionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  // Por ahora, solo administrador de sistema puede editar la producción
  const canEdit = appUser?.role === "admin_sistema";

  const { data: sectors } = await supabase
    .from("sectors")
    .select("id, name, plant_id, plants(name)")
    .order("name");

  return <ProduccionClient sectors={sectors ?? []} canEdit={canEdit} />;
}
