import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RepuestosEditor from "./RepuestosEditor";

export default async function RepuestosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  const canEdit = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  const [{ data: equipo }, { data: parts }] = await Promise.all([
    supabase.from("equipment").select("id, name, code, sectors(name, plants(name))").eq("id", id).single(),
    supabase.from("equipment_parts").select("*").eq("equipment_id", id).order("name"),
  ]);

  if (!equipo) redirect("/equipos");

  return <RepuestosEditor equipo={equipo} parts={parts ?? []} canEdit={canEdit} />;
}
