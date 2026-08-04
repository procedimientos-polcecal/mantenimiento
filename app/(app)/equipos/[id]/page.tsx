import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import EquipoDetalle from "./EquipoDetalle";

export default async function EquipoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .single();

  const [{ data: equipo }, { data: sectors }, { data: historial }] = await Promise.all([
    supabase
      .from("equipment")
      .select("*, sectors(id, name, plants(id, name))")
      .eq("id", id)
      .single(),
    supabase
      .from("sectors")
      .select("id, name, plants(id, name)")
      .order("name"),
    supabase
      .from("equipment_status_log")
      .select("*, changed_by_user:changed_by(full_name)")
      .eq("equipment_id", id)
      .order("changed_at", { ascending: false })
      .limit(10),
  ]);

  if (!equipo) notFound();

  // Referencia del tipo de equipo (specs típicas) + lista de tipos para editar
  const [{ data: tipo }, { data: tipos }] = await Promise.all([
    equipo.tipo_id
      ? supabase.from("equipment_types").select("*").eq("tipo_id", equipo.tipo_id).single()
      : Promise.resolve({ data: null } as any),
    supabase.from("equipment_types").select("tipo_id, nombre_tipo, categoria").order("nombre_tipo"),
  ]);

  const canEdit = appUser?.role === "admin_sistema" || appUser?.role === "administrador";

  return (
    <EquipoDetalle
      equipo={equipo}
      sectors={sectors ?? []}
      historial={historial ?? []}
      tipo={tipo}
      tipos={tipos ?? []}
      canEdit={canEdit}
      userId={user.id}
    />
  );
}
