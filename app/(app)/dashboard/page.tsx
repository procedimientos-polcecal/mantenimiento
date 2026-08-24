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
    // OT realizadas de las últimas 52 semanas (por fecha de ejecución).
    supabase.from("work_orders")
      .select("ot_number, equipo_raw, fecha_ejecucion, horas")
      .eq("estado", "REALIZADO")
      .gte("fecha_ejecucion", new Date(Date.now() - 7 * 52 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .order("fecha_ejecucion", { ascending: false })
      .limit(3000),
  ]);

  // Forma que espera el gráfico de realizadas
  const realizadas = (recentExecutions ?? []).map((o: any) => ({
    executed_at: o.fecha_ejecucion,
    ot_number: o.ot_number,
    equipo: o.equipo_raw,
    hours: o.horas,
  }));

  // ── Conteo de OTs por estado (count queries, sin traer todas las filas) ──────
  const OT_ESTADOS = ["POR_HACER", "EN_PROCESO", "ATRASADO", "REALIZADO", "SUSPENDIDA"];
  const otCounts = await Promise.all(
    OT_ESTADOS.map((e) =>
      supabase.from("work_orders").select("id", { count: "exact", head: true }).eq("estado", e)
    )
  );
  const otStats = OT_ESTADOS.map((estado, i) => ({ estado, count: otCounts[i].count ?? 0 }));

  // ── OTs generadas en el mes corriente (por la fecha de la OT) ────────────────
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const hoy = new Date();
  const y = hoy.getFullYear(), mo = hoy.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const mesInicio = `${y}-${pad(mo + 1)}-01`;
  const mesSig = mo === 11 ? `${y + 1}-01-01` : `${y}-${pad(mo + 2)}-01`;
  const { count: otMesCount } = await supabase.from("work_orders")
    .select("id", { count: "exact", head: true }).gte("fecha", mesInicio).lt("fecha", mesSig);
  const otMes = otMesCount ?? 0;
  const mesLabel = MESES[mo];

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

  // ── Ventanas de reparación (próxima semana) ──────────────────────────────────
  const nm = new Date(); nm.setHours(12, 0, 0, 0);
  nm.setDate(nm.getDate() - ((nm.getDay() + 6) % 7) + 7); // lunes de la próxima semana
  const nmIso = nm.toISOString().slice(0, 10);
  const [{ data: prodPlans }, { data: otSectors }] = await Promise.all([
    supabase.from("production_plan").select("sector_id, days").eq("week_start", nmIso),
    supabase.from("work_orders").select("sector_id").in("estado", ["POR_HACER", "EN_PROCESO", "ATRASADO"]).not("sector_id", "is", null),
  ]);
  const DIAS_D = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const planMap = new Map((prodPlans ?? []).map((p: any) => [p.sector_id, p.days]));
  const otCountBySector: Record<string, number> = {};
  for (const o of (otSectors ?? [])) otCountBySector[o.sector_id] = (otCountBySector[o.sector_id] ?? 0) + 1;
  const plantsMap: Record<string, any[]> = {};
  for (const s of (sectors ?? [])) { const pl = (s as any).plants?.name ?? "—"; (plantsMap[pl] ??= []).push(s); }
  const repairWindows = Object.entries(plantsMap).map(([plant, secs]) => {
    const hasPlan = secs.some((s) => planMap.has(s.id));
    const freeDays = Array.from({ length: 7 }, (_, i) => secs.every((s) => ((planMap.get(s.id) ?? Array(7).fill("LIBRE"))[i]) === "LIBRE"));
    const pendingOT = secs.reduce((a, s) => a + (otCountBySector[s.id] ?? 0), 0);
    return { plant, hasPlan, freeDayLabels: DIAS_D.filter((_, i) => freeDays[i]), pendingOT };
  }).filter((w) => w.hasPlan && w.freeDayLabels.length > 0);
  const repairWeekLabel = nm.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

  return (
    <DashboardClient
      repairWindows={repairWindows}
      repairWeekLabel={repairWeekLabel}
      otMes={otMes}
      mesLabel={mesLabel}
      appUser={appUser}
      equipment={equipment ?? []}
      plants={plants ?? []}
      sectors={sectors ?? []}
      sectorStatusLog={sectorStatusLog ?? []}
      recentExecutions={realizadas}
      otStats={otStats}
      tipoTally={tipoTally}
      quienTally={quienTally}
      canEdit={canEdit}
    />
  );
}
