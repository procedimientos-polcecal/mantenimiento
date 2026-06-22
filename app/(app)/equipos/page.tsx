import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EquiposClient from "./EquiposClient";

export default async function EquiposPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: plants }, { data: sectors }, { data: equipment }] = await Promise.all([
    supabase.from("plants").select("*").order("name"),
    supabase.from("sectors").select("*, plants(name)").order("name"),
    supabase
      .from("equipment")
      .select("*, sectors(name, plants(name))")
      .eq("is_active", true)
      .order("code"),
  ]);

  return (
    <EquiposClient
      plants={plants ?? []}
      sectors={sectors ?? []}
      equipment={equipment ?? []}
    />
  );
}
