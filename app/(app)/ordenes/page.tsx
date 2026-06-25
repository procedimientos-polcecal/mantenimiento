import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrdenesClient from "./OrdenesClient";

export default async function OrdenesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();

  const canSync = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  return <OrdenesClient canSync={canSync} />;
}
