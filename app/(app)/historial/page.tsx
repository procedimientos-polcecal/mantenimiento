import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HistorialClient from "./HistorialClient";

export default async function HistorialPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: executions } = await supabase
    .from("maintenance_executions")
    .select(`
      *,
      schedule:schedule_id(
        maintenance_type,
        schedule_type,
        equipment(name, code, sectors(name, plants(name)))
      ),
      executor:executed_by(full_name)
    `)
    .order("executed_at", { ascending: false })
    .limit(200);

  return <HistorialClient executions={executions ?? []} />;
}
