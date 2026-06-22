import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import ChecklistEditor from "./ChecklistEditor";

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role")
    .eq("id", user.id)
    .single();

  const canEdit = appUser?.role === "admin_sistema" || appUser?.role === "administrador";

  const [{ data: equipo }, { data: checklist }] = await Promise.all([
    supabase.from("equipment").select("id, name, code").eq("id", id).single(),
    supabase
      .from("equipment_checklists")
      .select("*")
      .eq("equipment_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!equipo) notFound();

  return (
    <ChecklistEditor
      equipo={equipo}
      checklist={checklist}
      canEdit={canEdit}
    />
  );
}
