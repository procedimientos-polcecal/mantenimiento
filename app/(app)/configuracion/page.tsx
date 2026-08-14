import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ConfiguracionClient from "./ConfiguracionClient";

export default async function ConfiguracionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();

  // Solo administrador de sistema
  if (appUser?.role !== "admin_sistema") redirect("/dashboard");

  const [{ data: sectors }, { data: plants }, { data: contratistas }, { data: operarios }] = await Promise.all([
    supabase.from("sectors").select("id, name, plant_id, plants(name)").order("name"),
    supabase.from("plants").select("id, name").order("name"),
    supabase.from("contratistas").select("id, nombre").order("nombre"),
    supabase.from("operarios").select("id, slot, nombre").order("slot").order("nombre"),
  ]);

  return <ConfiguracionClient sectors={sectors ?? []} plants={plants ?? []} contratistas={contratistas ?? []} operarios={operarios ?? []} />;
}
