import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .single();

  // Equipment status counts
  const { data: statusCounts } = await supabase
    .from("equipment")
    .select("status")
    .eq("is_active", true);

  const counts = {
    OPERATIVO: 0,
    EN_MANTENIMIENTO: 0,
    EN_REPARACION: 0,
    STANDBY: 0,
    FUERA_DE_SERVICIO: 0,
    DADO_DE_BAJA: 0,
  };

  statusCounts?.forEach((e) => {
    counts[e.status as keyof typeof counts]++;
  });

  // Upcoming maintenance (next 7 days)
  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const { data: upcoming } = await supabase
    .from("maintenance_schedules")
    .select("*, equipment(name, code), assigned_user:assigned_to(full_name)")
    .eq("status", "active")
    .lte("next_date", in7days)
    .gte("next_date", today)
    .order("next_date", { ascending: true })
    .limit(10);

  const { data: overdue } = await supabase
    .from("maintenance_schedules")
    .select("*, equipment(name, code), assigned_user:assigned_to(full_name)")
    .eq("status", "active")
    .lt("next_date", today)
    .order("next_date", { ascending: true })
    .limit(10);

  const ROLE_LABEL: Record<string, string> = {
    admin_sistema: "Admin sistema", administrador: "Administrador",
    tecnico: "Técnico", operador: "Operador",
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 22, color: "#0F172A", margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
          {appUser?.full_name ?? user.email}
          <span style={{ margin: "0 8px", color: "#E2E8F0" }}>·</span>
          <span style={{ background: "#FEF3C7", color: "#B45309", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "'Syne', sans-serif", letterSpacing: ".04em" }}>
            {ROLE_LABEL[appUser?.role] ?? appUser?.role}
          </span>
        </p>
      </div>

      {/* Status grid */}
      <div className="fade-up fade-up-1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        <StatusCard label="Operativo"         count={counts.OPERATIVO}         accent="#22C55E" dot="#16A34A" />
        <StatusCard label="En mantenimiento"  count={counts.EN_MANTENIMIENTO}  accent="#3B82F6" dot="#2563EB" />
        <StatusCard label="En reparación"     count={counts.EN_REPARACION}     accent="#EF4444" dot="#DC2626" />
        <StatusCard label="Standby"           count={counts.STANDBY}           accent="#F59E0B" dot="#D97706" />
        <StatusCard label="Fuera de servicio" count={counts.FUERA_DE_SERVICIO} accent="#94A3B8" dot="#64748B" />
        <StatusCard label="Dado de baja"      count={counts.DADO_DE_BAJA}      accent="#64748B" dot="#475569" />
      </div>

      {/* Overdue */}
      {overdue && overdue.length > 0 && (
        <section className="fade-up fade-up-2" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse-dot 2s infinite" }} />
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 13, color: "#DC2626", margin: 0, letterSpacing: ".04em", textTransform: "uppercase" }}>
              Vencidos — {overdue.length}
            </h2>
          </div>
          <div style={{ borderRadius: 12, border: "1px solid #FECACA", overflow: "hidden", background: "#fff" }}>
            {overdue.map((s: any, i: number) => (
              <ScheduleRow key={s.id} schedule={s} overdue last={i === overdue.length - 1} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      <section className="fade-up fade-up-3">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 13, color: "#64748B", margin: 0, letterSpacing: ".04em", textTransform: "uppercase" }}>
            Próximos 7 días — {upcoming?.length ?? 0}
          </h2>
        </div>
        {upcoming && upcoming.length > 0 ? (
          <div style={{ borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden", background: "#fff" }}>
            {upcoming.map((s: any, i: number) => (
              <ScheduleRow key={s.id} schedule={s} last={i === (upcoming.length - 1)} />
            ))}
          </div>
        ) : (
          <div style={{ borderRadius: 12, border: "1px dashed #E2E8F0", padding: "32px", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>Sin mantenimientos programados esta semana.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusCard({ label, count, accent, dot }: { label: string; count: number; accent: string; dot: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "18px 20px",
      border: "1px solid #E2E8F0", boxShadow: "0 1px 2px rgba(0,0,0,.05)",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: accent, borderRadius: "12px 12px 0 0",
      }} />
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 32, color: "#0F172A", lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ position: "absolute", bottom: 12, right: 16, width: 8, height: 8, borderRadius: "50%", background: dot, opacity: .4 }} />
    </div>
  );
}

function ScheduleRow({ schedule, overdue, last }: { schedule: any; overdue?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      padding: "12px 16px",
      borderBottom: last ? "none" : `1px solid ${overdue ? "#FECACA" : "#F1F5F9"}`,
      background: overdue ? "#FFF5F5" : "#fff",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#94A3B8", background: "#F8FAFC", padding: "1px 6px", borderRadius: 4, border: "1px solid #E2E8F0" }}>
            {schedule.equipment?.code}
          </span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#0F172A" }}>{schedule.equipment?.name}</span>
          <span style={{ fontSize: 11, color: "#94A3B8" }}>{schedule.maintenance_type}</span>
        </div>
        {schedule.assigned_user?.full_name && (
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{schedule.assigned_user.full_name}</div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 13, color: overdue ? "#DC2626" : "#0F172A" }}>
          {schedule.next_date ? new Date(schedule.next_date + "T00:00:00").toLocaleDateString("es-AR") : "—"}
        </div>
      </div>
    </div>
  );
}
