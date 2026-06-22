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

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Bienvenido, {appUser?.full_name ?? user.email} · {appUser?.role}
        </p>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatusCard label="Operativo" count={counts.OPERATIVO} color="green" />
        <StatusCard label="En mantenimiento" count={counts.EN_MANTENIMIENTO} color="blue" />
        <StatusCard label="En reparación" count={counts.EN_REPARACION} color="red" />
        <StatusCard label="Standby" count={counts.STANDBY} color="yellow" />
        <StatusCard label="Fuera de servicio" count={counts.FUERA_DE_SERVICIO} color="gray" />
        <StatusCard label="Dado de baja" count={counts.DADO_DE_BAJA} color="slate" />
      </div>

      {/* Overdue */}
      {overdue && overdue.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            Vencidos ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map((s: any) => (
              <ScheduleRow key={s.id} schedule={s} overdue />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Próximos 7 días ({upcoming?.length ?? 0})
        </h2>
        {upcoming && upcoming.length > 0 ? (
          <div className="space-y-2">
            {upcoming.map((s: any) => (
              <ScheduleRow key={s.id} schedule={s} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Sin mantenimientos programados esta semana.</p>
        )}
      </section>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-green-50 border-green-200 text-green-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    red: "bg-red-50 border-red-200 text-red-800",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    slate: "bg-slate-50 border-slate-200 text-slate-600",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </div>
  );
}

function ScheduleRow({ schedule, overdue }: { schedule: any; overdue?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-2 ${overdue ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div>
        <span className="text-sm font-medium text-gray-900">
          {schedule.equipment?.code} — {schedule.equipment?.name}
        </span>
        <span className="ml-2 text-xs text-gray-500">{schedule.maintenance_type}</span>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xs font-semibold ${overdue ? "text-red-700" : "text-gray-700"}`}>
          {schedule.next_date}
        </div>
        <div className="text-xs text-gray-400">{schedule.assigned_user?.full_name}</div>
      </div>
    </div>
  );
}
