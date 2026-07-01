import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrdenesClient from "./OrdenesClient";

export default async function OrdenesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();

  const canAdmin = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  const [{ data: sectors }, { data: equipment }] = await Promise.all([
    supabase.from("sectors").select("id, name, plants(name)").order("name"),
    supabase.from("equipment").select("id, name, code, sector_id, status").eq("is_active", true).order("code"),
  ]);

  return (
    <OrdenesClient
      canSync={canAdmin}
      canEdit={canAdmin}
      sectors={sectors ?? []}
      equipment={equipment ?? []}
    />
  );
}
