import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ComponentesEditor from "./ComponentesEditor";

export default async function ComponentesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users").select("role").eq("id", user.id).single();
  const canEdit = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  const [{ data: equipo }, { data: components }] = await Promise.all([
    supabase.from("equipment").select("id, name, code").eq("id", id).single(),
    supabase.from("equipment_components").select("*").eq("equipment_id", id).order("nombre"),
  ]);
  if (!equipo) redirect("/equipos");

  return <ComponentesEditor equipo={equipo} components={components ?? []} canEdit={canEdit} />;
}
