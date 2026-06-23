"use client";

import { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

const STATUS_META: Record<string, { label: string; color: string; accent: string }> = {
  OPERATIVO:         { label: "Operativo",        color: "#22C55E", accent: "#DCFCE7" },
  EN_MANTENIMIENTO:  { label: "En mantenimiento", color: "#3B82F6", accent: "#DBEAFE" },
  EN_REPARACION:     { label: "En reparación",    color: "#EF4444", accent: "#FEE2E2" },
  STANDBY:           { label: "Standby",           color: "#F59E0B", accent: "#FEF3C7" },
  FUERA_DE_SERVICIO: { label: "Fuera de servicio", color: "#94A3B8", accent: "#F1F5F9" },
  DADO_DE_BAJA:      { label: "Dado de baja",      color: "#64748B", accent: "#F8FAFC" },
};

const ROLE_LABEL: Record<string, string> = {
  admin_sistema: "Admin sistema", administrador: "Administrador",
  gerente: "Gerente", operario: "Operario",
};

export default function DashboardClient({ appUser, equipment, upcoming, overdue, plants, recentExecutions }: {
  appUser: any;
  equipment: any[];
  upcoming: any[];
  overdue: any[];
  plants: any[];
  recentExecutions: any[];
}) {
  const [plantFilter, setPlantFilter] = useState("TODAS");

  const filteredEquipment = useMemo(() =>
    plantFilter === "TODAS"
      ? equipment
      : equipment.filter((e) => (e.sectors as any)?.plants?.name === plantFilter),
    [equipment, plantFilter]
  );

  // Status donut data
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of filteredEquipment) {
      counts[e.status] = (counts[e.status] ?? 0) + 1;
    }
    return Object.entries(STATUS_META)
      .map(([key, meta]) => ({ name: meta.label, value: counts[key] ?? 0, color: meta.color, key }))
      .filter((d) => d.value > 0);
  }, [filteredEquipment]);

  // Criticality bar data per plant
  const criticalityData = useMemo(() => {
    const plantNames = plants.map((p) => p.name);
    return ["ALTA", "MEDIA", "BAJA"].map((crit) => {
      const row: any = { criticidad: crit };
      for (const p of plantNames) {
        row[p] = equipment.filter(
          (e) => e.criticality === crit && (e.sectors as any)?.plants?.name === p
        ).length;
      }
      return row;
    });
  }, [equipment, plants]);

  // Executions per week (last 8 weeks)
  const executionTrend = useMemo(() => {
    const weeks: Record<string, number> = {};
    for (const ex of recentExecutions) {
      if (!ex.executed_at) continue;
      const d = new Date(ex.executed_at);
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      const key = monday.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
      weeks[key] = (weeks[key] ?? 0) + 1;
    }
    return Object.entries(weeks)
      .slice(-8)
      .map(([semana, cantidad]) => ({ semana, cantidad }));
  }, [recentExecutions]);

  const total = filteredEquipment.length;
  const operativos = filteredEquipment.filter((e) => e.status === "OPERATIVO").length;
  const pctOperativo = total > 0 ? Math.round((operativos / total) * 100) : 0;

  const PLANT_COLORS: Record<string, string> = {
    POLYSAN:  "#F59E0B",
    POLCECAL: "#22C55E",
    AMBOS:    "#3B82F6",
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {appUser?.full_name ?? ""}
            <span className="mx-2 text-gray-200">·</span>
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded">
              {ROLE_LABEL[appUser?.role] ?? appUser?.role}
            </span>
          </p>
        </div>

        {/* Plant filter pill */}
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
          {["TODAS", ...plants.map((p) => p.name)].map((p) => (
            <button
              key={p}
              onClick={() => setPlantFilter(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: plantFilter === p ? (p === "TODAS" ? "#0F172A" : PLANT_COLORS[p] ?? "#0F172A") : "transparent",
                color: plantFilter === p ? "#fff" : "#64748B",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total equipos" value={total} accent="#0F172A" />
        <KpiCard label="Operativos" value={operativos} accent="#22C55E" sub={`${pctOperativo}% del total`} />
        <KpiCard label="Vencidos" value={overdue.length} accent={overdue.length > 0 ? "#EF4444" : "#22C55E"} />
        <KpiCard label="Próximos 7 días" value={upcoming.length} accent="#F59E0B" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Status donut */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
            Estado de equipos
            {plantFilter !== "TODAS" && (
              <span className="ml-2 text-xs font-normal text-gray-400">— {plantFilter}</span>
            )}
          </h2>
          {statusData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">Sin datos</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%" cy="50%"
                      innerRadius={42} outerRadius={68}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusData.map((d) => (
                        <Cell key={d.key} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} equipos`, name]}
                      contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E2E8F0" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                {statusData.map((d) => (
                  <div key={d.key} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-gray-600 truncate">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900 shrink-0">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Criticality by plant bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
            Criticidad por planta
          </h2>
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={criticalityData} barSize={20} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="criticidad" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E2E8F0" }}
                cursor={{ fill: "#F8FAFC" }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {plants.map((p) => (
                <Bar key={p.name} dataKey={p.name} fill={PLANT_COLORS[p.name] ?? "#94A3B8"} radius={[4,4,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Execution trend */}
      {executionTrend.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
            Ejecuciones por semana (últimas 8 semanas)
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={executionTrend} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E2E8F0" }}
                formatter={(v: any) => [`${v} ejecuciones`]}
                cursor={{ fill: "#F8FAFC" }}
              />
              <Bar dataKey="cantidad" fill="#3B82F6" radius={[4,4,0,0]} name="Ejecuciones" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wider" style={{ fontFamily: "'Syne', sans-serif" }}>
              Vencidos — {overdue.length}
            </h2>
          </div>
          <div className="rounded-xl border border-red-100 overflow-hidden bg-white">
            {overdue.map((s: any, i: number) => (
              <ScheduleRow key={s.id} schedule={s} overdue last={i === overdue.length - 1} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ fontFamily: "'Syne', sans-serif" }}>
            Próximos 7 días — {upcoming.length}
          </h2>
        </div>
        {upcoming.length > 0 ? (
          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            {upcoming.map((s: any, i: number) => (
              <ScheduleRow key={s.id} schedule={s} last={i === upcoming.length - 1} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
            <p className="text-sm text-gray-400">Sin mantenimientos programados esta semana.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value, accent, sub }: { label: string; value: number; accent: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: accent }}>{sub}</div>}
    </div>
  );
}

function ScheduleRow({ schedule, overdue, last }: { schedule: any; overdue?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-3 ${!last ? `border-b ${overdue ? "border-red-100" : "border-gray-100"}` : ""} ${overdue ? "bg-red-50" : "bg-white"}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
            {schedule.equipment?.code}
          </span>
          <span className="text-sm font-medium text-gray-900">{schedule.equipment?.name}</span>
          <span className="text-xs text-gray-400">{schedule.maintenance_type}</span>
        </div>
        {schedule.assigned_user?.full_name && (
          <p className="text-xs text-gray-400 mt-0.5">{schedule.assigned_user.full_name}</p>
        )}
      </div>
      <div className={`text-sm font-semibold shrink-0 ${overdue ? "text-red-600" : "text-gray-700"}`}>
        {schedule.next_date
          ? new Date(schedule.next_date + "T00:00:00").toLocaleDateString("es-AR")
          : "—"}
      </div>
    </div>
  );
}
