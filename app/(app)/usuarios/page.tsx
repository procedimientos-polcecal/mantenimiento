import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UsuariosClient from "./UsuariosClient";

export default async function UsuariosPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (appUser?.role !== "admin_sistema") redirect("/dashboard");

  const { data: users } = await supabase
    .from("app_users")
    .select("*")
    .order("full_name");

  return <UsuariosClient users={users ?? []} />;
}
