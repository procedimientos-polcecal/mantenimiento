import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: appUser },
    { data: equipment },
    { data: plants },
    { data: sectors },
    { data: sectorStatusLog },
    { data: recentExecutions },
  ] = await Promise.all([
    supabase.from("app_users").select("*").eq("id", user.id).single(),
    supabase.from("equipment")
      .select("status, criticality, sectors(name, plants(name))")
      .eq("is_active", true),
    supabase.from("plants").select("id, name, status").order("name"),
    supabase.from("sectors").select("id, name, status, plants(name)").order("name"),
    supabase.from("sector_status_log")
      .select("*, sector:sector_id(name, plants(name)), changed_by_user:changed_by(full_name)")
      .order("changed_at", { ascending: false })
      .limit(20),
    // Ejecuciones de OT de las últimas 52 semanas (permite comparar 26 vs 26 previas).
    supabase.from("maintenance_executions")
      .select("execution_status, executed_at, duration_hours, work_order:work_order_id(ot_number, equipo_raw, equipo_code)")
      .not("work_order_id", "is", null)
      .gte("executed_at", new Date(Date.now() - 7 * 52 * 24 * 60 * 60 * 1000).toISOString())
      .order("executed_at", { ascending: false })
      .limit(2000),
  ]);

  // ── Conteo de OTs por estado (count queries, sin traer todas las filas) ──────
  const OT_ESTADOS = ["POR_HACER", "EN_PROCESO", "ATRASADO", "REALIZADO", "SUSPENDIDA"];
  const otCounts = await Promise.all(
    OT_ESTADOS.map((e) =>
      supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("estado", e)
    )
  );
  const otStats = OT_ESTADOS.map((estado, i) => ({ estado, count: otCounts[i].count ?? 0 }));

  // ── Tipo de trabajo (correctivo/preventivo) y ejecución (propio/contratado) ──
  // Se usan count queries (head) para no chocar con el límite de filas de Supabase.
  const woCount = (build: (q: any) => any) =>
    build(supabase.from("work_orders").select("id", { count: "exact", head: true }));

  const [
    tipoTotalR, correctivoR, preventivoR,
    quienTotalR, contratadoR, propioR, mixtoR,
  ] = await Promise.all([
    woCount((q) => q.not("tipo", "is", null).neq("tipo", "")),
    woCount((q) => q.ilike("tipo", "%correctiv%")),
    woCount((q) => q.or("tipo.ilike.%prevent%,tipo.ilike.%program%")),
    woCount((q) => q.not("quien", "is", null).neq("quien", "")),
    woCount((q) => q.ilike("quien", "%contrat%")),
    woCount((q) => q.or("quien.ilike.%propio%,quien.ilike.%interno%")),
    woCount((q) => q.ilike("quien", "%mixto%")),
  ]);

  const correctivo = correctivoR.count ?? 0;
  const preventivo = preventivoR.count ?? 0;
  const contratado = contratadoR.count ?? 0;
  const propio     = propioR.count ?? 0;
  const mixto      = mixtoR.count ?? 0;

  const tipoTally: Record<string, number> = {
    Correctivo: correctivo,
    Preventivo: preventivo,
    Otro: Math.max(0, (tipoTotalR.count ?? 0) - correctivo - preventivo),
  };
  const quienTally: Record<string, number> = {
    Propio: propio,
    Contratado: contratado,
    Mixto: mixto,
    Otro: Math.max(0, (quienTotalR.count ?? 0) - propio - contratado - mixto),
  };

  const canEdit = ["admin_sistema", "administrador"].includes(appUser?.role ?? "");

  return (
    <DashboardClient
      appUser={appUser}
      equipment={equipment ?? []}
      plants={plants ?? []}
      sectors={sectors ?? []}
      sectorStatusLog={sectorStatusLog ?? []}
      recentExecutions={recentExecutions ?? []}
      otStats={otStats}
      tipoTally={tipoTally}
      quienTally={quienTally}
      canEdit={canEdit}
    />
  );
}
