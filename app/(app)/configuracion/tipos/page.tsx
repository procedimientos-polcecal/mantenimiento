import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TiposClient from "./TiposClient";

export default async function TiposPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  if (appUser?.role !== "admin_sistema") redirect("/dashboard");

  const { data: tipos } = await supabase
    .from("equipment_types").select("*").order("nombre_tipo");

  return <TiposClient tipos={tipos ?? []} />;
}
