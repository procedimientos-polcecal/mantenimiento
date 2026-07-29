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
    supabase.from("maintenance_executions")
      .select("execution_status, executed_at")
      .order("executed_at", { ascending: false })
      .limit(60),
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
  // Los valores vienen del Sheet como texto libre → se categorizan con match flexible.
  const { data: woMeta } = await supabase
    .from("work_orders")
    .select("tipo, quien")
    .range(0, 9999);

  const tipoTally: Record<string, number> = { Correctivo: 0, Preventivo: 0, Otro: 0 };
  const quienTally: Record<string, number> = { Propio: 0, Contratado: 0, Mixto: 0, Otro: 0 };
  for (const w of woMeta ?? []) {
    const t = (w.tipo ?? "").toString().toLowerCase();
    if (t) {
      if (t.includes("correctiv")) tipoTally.Correctivo++;
      else if (t.includes("prevent") || t.includes("program")) tipoTally.Preventivo++;
      else tipoTally.Otro++;
    }
    const q = (w.quien ?? "").toString().toLowerCase();
    if (q) {
      if (q.includes("contrat")) quienTally.Contratado++;
      else if (q.includes("propio") || q.includes("interno")) quienTally.Propio++;
      else if (q.includes("mixto")) quienTally.Mixto++;
      else quienTally.Otro++;
    }
  }

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
