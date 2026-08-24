"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import InfoTip from "@/app/components/InfoTip";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  OPERATIVO:         { label: "Operativo",        color: "#22C55E" },
  EN_MANTENIMIENTO:  { label: "En mantenimiento", color: "#3B82F6" },
  STANDBY:           { label: "Standby",           color: "#F59E0B" },
  FUERA_DE_SERVICIO: { label: "Fuera de servicio", color: "#94A3B8" },
  DADO_DE_BAJA:      { label: "Dado de baja",      color: "#64748B" },
};

const PLANT_STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ACTIVA:        { label: "Activa",        color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  PARADA:        { label: "Parada",        color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  EN_REPARACION: { label: "En reparación", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
};

const PLANT_STATUS_OPTIONS = [
  { value: "ACTIVA",        label: "Activa" },
  { value: "PARADA",        label: "Parada" },
  { value: "EN_REPARACION", label: "En reparación" },
];

const ROLE_LABEL: Record<string, string> = {
  admin_sistema: "Admin sistema", administrador: "Administrador",
  jefe_produccion: "Jefe de Producción", gerente: "Gerente", operario: "Operario",
};

const PLANT_COLORS: Record<string, string> = {
  POLYSAN: "#F59E0B", POLCECAL: "#22C55E", AMBOS: "#3B82F6",
};

const OT_ESTADO_META: Record<string, { label: string; color: string }> = {
  POR_HACER:  { label: "Por hacer",  color: "#94A3B8" },
  EN_PROCESO: { label: "En proceso", color: "#3B82F6" },
  ATRASADO:   { label: "Atrasado",   color: "#EF4444" },
  REALIZADO:  { label: "Realizado",  color: "#22C55E" },
  SUSPENDIDA: { label: "Suspendida", color: "#F59E0B" },
};

const TIPO_COLORS: Record<string, string> = {
  Correctivo: "#EF4444", Preventivo: "#22C55E", Otro: "#94A3B8",
};
const QUIEN_COLORS: Record<string, string> = {
  Propio: "#3B82F6", Contratado: "#8B5CF6", Mixto: "#F59E0B", Otro: "#94A3B8",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardClient({
  appUser, equipment,
  plants, sectors, sectorStatusLog, recentExecutions, otStats, tipoTally, quienTally, canEdit,
  repairWindows = [], repairWeekLabel = "", otMes = 0, mesLabel = "", otPorMes = [], paradaSectorIds = [],
}: {
  appUser: any;
  equipment: any[];
  plants: any[];
  sectors: any[];
  plantStatusLog?: any[];   // kept for compat, unused
  sectorStatusLog: any[];
  recentExecutions: any[];
  otStats: { estado: string; count: number }[];
  tipoTally: Record<string, number>;
  quienTally: Record<string, number>;
  canEdit: boolean;
  repairWindows?: { plant: string; freeDayLabels: string[]; pendingOT: number }[];
  repairWeekLabel?: string;
  otMes?: number;
  mesLabel?: string;
  otPorMes?: { mes: string; cantidad: number }[];
  paradaSectorIds?: string[];
}) {
  const paradaSet = new Set(paradaSectorIds);
  const router = useRouter();
  const [plantFilter, setPlantFilter] = useState("TODAS");
  const [sectorFilter, setSectorFilter] = useState("TODOS");

  // Sector status modal state
  const [statusModal, setStatusModal] = useState<{ sector: any } | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [reason, setReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [showLog, setShowLog] = useState(false);

  const availableSectors = useMemo(() =>
    plantFilter === "TODAS" ? sectors : sectors.filter((s: any) => s.plants?.name === plantFilter),
    [sectors, plantFilter]
  );

  function handlePlantChange(plant: string) {
    setPlantFilter(plant);
    setSectorFilter("TODOS");
  }

  const filteredEquipment = useMemo(() => equipment.filter((e: any) => {
    if (plantFilter !== "TODAS" && e.sectors?.plants?.name !== plantFilter) return false;
    if (sectorFilter !== "TODOS" && e.sectors?.name !== sectorFilter) return false;
    return true;
  }), [equipment, plantFilter, sectorFilter]);

  // Status donut
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of filteredEquipment) counts[e.status] = (counts[e.status] ?? 0) + 1;
    return Object.entries(STATUS_META)
      .map(([key, meta]) => ({ name: meta.label, value: counts[key] ?? 0, color: meta.color, key }))
      .filter((d) => d.value > 0);
  }, [filteredEquipment]);

  // Criticality bars
  const { criticalityData, criticalityKeys, criticalityColors } = useMemo(() => {
    if (sectorFilter !== "TODOS") {
      const data = ["ALTA", "MEDIA", "BAJA"].map((crit) => ({
        criticidad: crit,
        Equipos: filteredEquipment.filter((e) => e.criticality === crit).length,
      }));
      return { criticalityData: data, criticalityKeys: ["Equipos"], criticalityColors: { Equipos: "#3B82F6" } };
    }
    if (plantFilter !== "TODAS") {
      const plantSectors = sectors.filter((s: any) => s.plants?.name === plantFilter).map((s: any) => s.name);
      const colors = ["#3B82F6","#8B5CF6","#EC4899","#14B8A6","#F97316","#84CC16","#06B6D4","#A78BFA"];
      const colorMap: Record<string, string> = {};
      plantSectors.forEach((s: string, i: number) => { colorMap[s] = colors[i % colors.length]; });
      const data = ["ALTA", "MEDIA", "BAJA"].map((crit) => {
        const row: any = { criticidad: crit };
        for (const s of plantSectors) {
          row[s] = equipment.filter((e) => e.criticality === crit && e.sectors?.name === s && e.sectors?.plants?.name === plantFilter).length;
        }
        return row;
      });
      return { criticalityData: data, criticalityKeys: plantSectors, criticalityColors: colorMap };
    }
    const plantNames = plants.map((p) => p.name);
    const data = ["ALTA", "MEDIA", "BAJA"].map((crit) => {
      const row: any = { criticidad: crit };
      for (const p of plantNames) row[p] = equipment.filter((e) => e.criticality === crit && e.sectors?.plants?.name === p).length;
      return row;
    });
    return { criticalityData: data, criticalityKeys: plantNames, criticalityColors: PLANT_COLORS };
  }, [equipment, filteredEquipment, plantFilter, sectorFilter, plants, sectors]);

  // OTs por estado (no se filtra por planta/sector: es global)
  const otTotal = useMemo(() => otStats.reduce((a, s) => a + s.count, 0), [otStats]);
  const otPendientes = useMemo(() =>
    otStats.filter((s) => ["POR_HACER", "EN_PROCESO", "ATRASADO"].includes(s.estado))
      .reduce((a, s) => a + s.count, 0),
    [otStats]
  );
  const total = filteredEquipment.length;
  const operativos = filteredEquipment.filter((e) => e.status === "OPERATIVO").length;
  const pctOperativo = total > 0 ? Math.round((operativos / total) * 100) : 0;
  // Equipos fuera de servicio (no disponibles). "En mantenimiento" no cuenta acá.
  const fueraServicio = filteredEquipment.filter((e) => e.status === "FUERA_DE_SERVICIO").length;
  // Equipos de criticidad ALTA que no están operativos
  const criticos = filteredEquipment.filter((e) => e.criticality === "ALTA" && e.status !== "OPERATIVO").length;
  const filterLabel = sectorFilter !== "TODOS" ? sectorFilter : plantFilter !== "TODAS" ? plantFilter : null;

  // Drill-down: /equipos preservando el filtro de planta/sector activo del dashboard.
  const equiposHref = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (plantFilter !== "TODAS") p.set("planta", plantFilter);
    if (sectorFilter !== "TODOS") p.set("sector", sectorFilter);
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/equipos${qs ? `?${qs}` : ""}`;
  };
  const [donutActive, setDonutActive] = useState<number | null>(null);

  // ── Sector status modal handlers ────────────────────────────────────────────
  function openStatusModal(sector: any) {
    setStatusModal({ sector });
    setNewStatus(sector.status ?? "ACTIVA");
    setReason("");
    setStatusError("");
  }

  const requiresReason = ["PARADA", "EN_REPARACION"].includes(newStatus);

  async function saveStatus() {
    if (requiresReason && !reason.trim()) {
      setStatusError("Ingresá una justificación para este cambio.");
      return;
    }
    setStatusSaving(true);
    setStatusError("");
    const res = await fetch("/api/sectores/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector_id: statusModal!.sector.id, new_status: newStatus, reason }),
    });
    const data = await res.json();
    if (!res.ok) { setStatusError(data.error ?? "Error al actualizar"); setStatusSaving(false); return; }
    setStatusSaving(false);
    setStatusModal(null);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
            Dashboard
            <InfoTip text="Vista general del estado de las plantas: equipos por estado y criticidad, mantenimientos vencidos y próximos, órdenes de trabajo por estado, y qué trabajos fueron correctivos/preventivos o propios/contratados. Usá los filtros de planta y sector para acotar." />
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {appUser?.full_name ?? ""}
            <span className="mx-2 text-gray-200">·</span>
            <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded">
              {ROLE_LABEL[appUser?.role] ?? appUser?.role}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {["TODAS", ...plants.map((p) => p.name)].map((p) => (
              <button key={p} onClick={() => handlePlantChange(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: plantFilter === p ? (PLANT_COLORS[p] ?? "#0F172A") : "transparent", color: plantFilter === p ? "#fff" : "#64748B" }}>
                {p}
              </button>
            ))}
          </div>
          {plantFilter !== "TODAS" && availableSectors.length > 0 && (
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300">
              <option value="TODOS">Todos los sectores</option>
              {availableSectors.map((s: any) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Sector status cards */}
      {(() => {
        const visibleSectors = plantFilter === "TODAS"
          ? sectors
          : sectors.filter((s: any) => s.plants?.name === plantFilter);
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleSectors.map((sector: any) => {
                const meta = PLANT_STATUS_META[sector.status ?? "ACTIVA"] ?? PLANT_STATUS_META.ACTIVA;
                const lastChange = sectorStatusLog.find((l: any) => l.sector?.name === sector.name);
                return (
                  <div key={sector.id} className="rounded-xl border p-4 flex items-start justify-between gap-3"
                    style={{ background: meta.bg, borderColor: meta.border }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                        <span className="font-semibold text-gray-900 text-sm" style={{ fontFamily: "'Syne', sans-serif" }}>
                          {sector.name}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                          style={{ color: meta.color, borderColor: meta.border, background: "white" }}>
                          {meta.label}
                        </span>
                        {paradaSet.has(sector.id) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"
                            title="Hay una OT pendiente que requiere parar este sector">⛔ Parar</span>
                        )}
                      </div>
                      {plantFilter === "TODAS" && (
                        <p className="text-xs text-gray-400 mt-0.5">{sector.plants?.name}</p>
                      )}
                      {lastChange && (
                        <p className="text-xs text-gray-500 mt-1.5 leading-snug">
                          <span className="font-medium">{lastChange.changed_by_user?.full_name ?? "—"}</span>
                          {" · "}{new Date(lastChange.changed_at).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit" })}
                          {lastChange.reason && <> · <span className="italic">"{lastChange.reason}"</span></>}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <button onClick={() => openStatusModal(sector)}
                        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Cambiar estado
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {sectorStatusLog.length > 0 && (
              <div>
                <button onClick={() => setShowLog((v) => !v)}
                  className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
                  <svg className={`w-3 h-3 transition-transform ${showLog ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {showLog ? "Ocultar" : "Ver"} historial de cambios de sector
                </button>
                {showLog && (
                  <div className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
                    {sectorStatusLog.map((log: any, i: number) => {
                      const meta = PLANT_STATUS_META[log.new_status] ?? PLANT_STATUS_META.ACTIVA;
                      return (
                        <div key={log.id} className={`px-4 py-3 text-sm ${i < sectorStatusLog.length - 1 ? "border-b border-gray-100" : ""}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-800">{log.sector?.name}</span>
                            <span className="text-xs text-gray-400">{log.sector?.plants?.name}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-semibold text-xs px-2 py-0.5 rounded-full" style={{ color: meta.color, background: meta.bg }}>
                              {meta.label}
                            </span>
                            <span className="text-xs text-gray-400 ml-auto">
                              {log.changed_by_user?.full_name ?? "—"} · {new Date(log.changed_at).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                            </span>
                          </div>
                          {log.reason && <p className="text-xs text-gray-500 mt-0.5 italic">"{log.reason}"</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total equipos"    value={total}         accent="#0F172A" href={equiposHref()} />
        <KpiCard label="Operativos"       value={operativos}    accent="#22C55E" sub={`${pctOperativo}% del total`} href={equiposHref({ status: "OPERATIVO" })} />
        <KpiCard label="Fuera de servicio"     value={fueraServicio} accent={fueraServicio > 0 ? "#EF4444" : "#22C55E"} href={equiposHref({ status: "FUERA_DE_SERVICIO" })} />
        <KpiCard label="Críticos no operativos" value={criticos}      accent={criticos > 0 ? "#EF4444" : "#22C55E"} href={equiposHref({ criticidad: "ALTA" })} />
      </div>

      {/* OTs del mes + evolución mensual */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row gap-5">
          <Link href="/ordenes" className="md:w-44 shrink-0 flex flex-col justify-center rounded-xl hover:bg-gray-50 transition-colors md:-m-2 md:p-2">
            <div className="text-4xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>{otMes}</div>
            <div className="text-xs text-gray-500 mt-1">OTs generadas en {mesLabel}</div>
            <div className="text-xs text-blue-600 mt-1">Ver órdenes →</div>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 mb-2">OTs generadas por mes (últimos 12)</p>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={otPorMes} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E2E8F0" }} formatter={(v: any) => [`${v} OTs`]} cursor={{ fill: "#F8FAFC" }} />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} name="OTs">
                  {otPorMes.map((_, i) => <Cell key={i} fill={i === otPorMes.length - 1 ? "#1D4ED8" : "#93C5FD"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status donut */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Syne', sans-serif" }}>Estado de equipos</h2>
            {filterLabel && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{filterLabel}</span>}
          </div>
          {statusData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">Sin datos</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-44 h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={2} dataKey="value" strokeWidth={0}
                      onMouseEnter={(_: any, i: number) => setDonutActive(i)}
                      onMouseLeave={() => setDonutActive(null)}
                      onClick={(_: any, i: number) => router.push(equiposHref({ status: statusData[i].key }))}
                      style={{ cursor: "pointer" }}>
                      {statusData.map((d, i) => (
                        <Cell key={d.key} fill={d.color}
                          opacity={donutActive == null || donutActive === i ? 1 : 0.35} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any, name: any) => [`${val} equipos`, name]}
                      contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E2E8F0" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                {statusData.map((d, i) => (
                  <Link key={d.key} href={equiposHref({ status: d.key })}
                    onMouseEnter={() => setDonutActive(i)} onMouseLeave={() => setDonutActive(null)}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors cursor-pointer"
                    style={{ opacity: donutActive == null || donutActive === i ? 1 : 0.4 }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-gray-600 truncate">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900 shrink-0">{d.value}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Criticality bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
            {sectorFilter !== "TODOS" ? `Criticidad — ${sectorFilter}` : plantFilter !== "TODAS" ? `Criticidad por sector — ${plantFilter}` : "Criticidad por planta"}
          </h2>
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={criticalityData} barSize={18} barCategoryGap="35%"
              onClick={(state: any) => { const l = state?.activeLabel; if (l) router.push(equiposHref({ criticidad: l })); }}
              style={{ cursor: "pointer" }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="criticidad" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid #E2E8F0" }} cursor={{ fill: "#F8FAFC" }} />
              {criticalityKeys.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
              {criticalityKeys.map((key) => <Bar key={key} dataKey={key} fill={criticalityColors[key] ?? "#94A3B8"} radius={[4,4,0,0]} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Órdenes de trabajo por estado */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Syne', sans-serif" }}>
            Órdenes de trabajo por estado
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Total: <span className="font-semibold text-gray-700">{otTotal}</span></span>
            <span className="text-gray-200">·</span>
            <span className="text-amber-600 font-semibold">{otPendientes} pendientes</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {otStats.map((s) => {
            const meta = OT_ESTADO_META[s.estado] ?? { label: s.estado, color: "#94A3B8" };
            const pct = otTotal > 0 ? Math.round((s.count / otTotal) * 100) : 0;
            return (
              <Link key={s.estado} href={`/ordenes?estado=${s.estado}`}
                className="bg-white rounded-xl border border-gray-200 p-4 relative overflow-hidden block hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: meta.color }} />
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="text-xs font-medium text-gray-500 truncate">{meta.label}</span>
                </div>
                <div className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>{s.count}</div>
                <div className="text-xs text-gray-400 mt-0.5">{pct}% del total</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Indicadores: tipo de trabajo y ejecución */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IndicatorGroup title="Tipo de trabajo" tally={tipoTally} colors={TIPO_COLORS}
          hrefFor={(l) => l === "Correctivo" ? "/ordenes?tipo=correctivo" : l === "Preventivo" ? "/ordenes?tipo=preventivo" : null} />
        <IndicatorGroup title="Ejecución del trabajo" tally={quienTally} colors={QUIEN_COLORS}
          hrefFor={(l) => ["Propio", "Contratado", "Mixto"].includes(l) ? `/ordenes?quien=${l.toLowerCase()}` : null} />
      </div>

      {/* Ventanas de reparación (próxima semana) */}
      {repairWindows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Syne', sans-serif" }}>
              Ventanas de reparación
            </h2>
            <span className="text-xs text-gray-400">semana del {repairWeekLabel}</span>
            <InfoTip text="Plantas cuya producción planificada deja días con todos los sectores libres la próxima semana. Si además hay OT pendientes en esos sectores, conviene aprovechar la ventana." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {repairWindows.map((w) => (
              <Link key={w.plant} href="/produccion"
                className="rounded-xl border border-gray-200 p-3 block hover:border-green-300 hover:shadow-sm transition-all"
                style={{ background: "#F0FDF4" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-800">{w.plant}</span>
                  {w.pendingOT > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      🔧 {w.pendingOT} OT
                    </span>
                  )}
                </div>
                <p className="text-xs text-green-700 mt-1">Libre: {w.freeDayLabels.join(", ")}</p>
                {w.pendingOT > 0 && <p className="text-[11px] text-amber-700 mt-0.5">Aprovechá la ventana para reparar.</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* OT realizadas por semana */}
      <ExecutionTrendCard realizadas={recentExecutions} />

      {/* Sector status modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
              Cambiar estado — {statusModal.sector.name}
            </h2>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Nuevo estado</label>
              <div className="grid grid-cols-3 gap-2">
                {PLANT_STATUS_OPTIONS.map((opt) => {
                  const meta = PLANT_STATUS_META[opt.value];
                  const selected = newStatus === opt.value;
                  return (
                    <button key={opt.value} onClick={() => { setNewStatus(opt.value); setStatusError(""); }}
                      className="rounded-xl border-2 px-3 py-2.5 text-xs font-semibold text-center transition-all"
                      style={{
                        borderColor: selected ? meta.color : "#E2E8F0",
                        background: selected ? meta.bg : "#fff",
                        color: selected ? meta.color : "#64748B",
                      }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {requiresReason && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">
                  Justificación <span className="text-red-500">*</span>
                  <span className="font-normal text-gray-400 ml-1">— requerida para este estado</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setStatusError(""); }}
                  rows={3}
                  className="input resize-none w-full"
                  placeholder="Ej: Paro por mantenimiento programado de caldera principal..."
                />
              </div>
            )}

            {newStatus === statusModal.sector.status && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                El sector ya se encuentra en este estado.
              </p>
            )}

            {statusError && <p className="text-sm text-red-600">{statusError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveStatus}
                disabled={statusSaving || newStatus === statusModal.sector.status}
                className="rounded-lg btn-primary disabled:opacity-50"
              >
                {statusSaving ? "Guardando..." : "Confirmar cambio"}
              </button>
              <button onClick={() => setStatusModal(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IndicatorGroup({ title, tally, colors, hrefFor }: {
  title: string; tally: Record<string, number>; colors: Record<string, string>;
  hrefFor?: (label: string) => string | null;
}) {
  const entries = Object.entries(tally).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Syne', sans-serif" }}>{title}</h2>
        <span className="text-xs text-gray-400">Total: <span className="font-semibold text-gray-700">{total}</span></span>
      </div>
      {total === 0 ? (
        <div className="h-24 flex items-center justify-center text-sm text-gray-400">Sin datos</div>
      ) : (
        <div className="space-y-3">
          {entries.map(([label, value]) => {
            const color = colors[label] ?? "#94A3B8";
            const pct = Math.round((value / total) * 100);
            const href = hrefFor?.(label) ?? null;
            const row = (
              <>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-medium text-gray-600">{label}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    <span className="font-bold text-gray-900">{value}</span> · {pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </>
            );
            return href ? (
              <Link key={label} href={href} className="block rounded-lg -mx-2 px-2 py-1 hover:bg-gray-50 transition-colors cursor-pointer">{row}</Link>
            ) : (
              <div key={label}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, accent, sub, href }: { label: string; value: number; accent: string; sub?: string; href?: string }) {
  const inner = (
    <>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      <div className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: accent }}>{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href}
        className="bg-white rounded-xl border border-gray-200 p-4 relative overflow-hidden block hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
        {inner}
        <span className="absolute bottom-2 right-2 text-gray-300">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </span>
      </Link>
    );
  }
  return <div className="bg-white rounded-xl border border-gray-200 p-4 relative overflow-hidden">{inner}</div>;
}

// ── OT realizadas por semana (interactivo) ─────────────────────────────────────

const REALIZADA_COLOR = "#22C55E";
const RANGE_OPTIONS = [8, 12, 26];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); // lunes de esa semana
  return m;
}

// `realizadas`: OT con estado REALIZADO. Cada item: { executed_at, ot_number, equipo, hours }.
function ExecutionTrendCard({ realizadas }: { realizadas: any[] }) {
  const [range, setRange] = useState(8);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);

  const { chart, currTotal, prevTotal } = useMemo(() => {
    // Agrupa por lunes de la semana de ejecución.
    const buckets = new Map<number, any[]>();
    for (const r of realizadas) {
      if (!r.executed_at) continue;
      const key = mondayOf(new Date(r.executed_at)).getTime();
      let arr = buckets.get(key);
      if (!arr) { arr = []; buckets.set(key, arr); }
      arr.push(r);
    }
    const thisMonday = mondayOf(new Date());

    const buildWindow = (offset: number, count: number) => {
      const rows: any[] = [];
      for (let i = count - 1; i >= 0; i--) {
        const start = new Date(thisMonday.getTime() - (offset + i) * WEEK_MS);
        const items = (buckets.get(start.getTime()) ?? [])
          .slice()
          .sort((a, b) => (a.executed_at < b.executed_at ? 1 : -1));
        rows.push({
          key: start.getTime(),
          label: start.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
          total: items.length,
          hours: items.reduce((a, it) => a + (Number(it.hours) || 0), 0),
          items,
        });
      }
      return rows;
    };

    const curr = buildWindow(0, range);
    const prev = buildWindow(range, range);
    const sum = (rows: any[]) => rows.reduce((a, r) => a + r.total, 0);
    return { chart: curr, currTotal: sum(curr), prevTotal: sum(prev) };
  }, [realizadas, range]);

  const delta = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : null;
  const selectedRow = selectedKey != null ? chart.find((r) => r.key === selectedKey) ?? null : null;
  const totalAll = realizadas.length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      {/* Cabecera: título + selector de rango */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Syne', sans-serif" }}>
            OT realizadas por semana
          </h2>
          <InfoTip text="Órdenes de trabajo con estado Realizado, agrupadas por semana (lunes a domingo) según su fecha de ejecución. Click en una semana para ver el detalle." />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
          {RANGE_OPTIONS.map((r) => (
            <button key={r} onClick={() => { setRange(r); setSelectedKey(null); }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${range === r ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {r} sem
            </button>
          ))}
        </div>
      </div>

      {/* Resumen del período */}
      <div className="flex items-center gap-3 mb-4 text-xs text-gray-500">
        <span><span className="font-bold text-gray-900 text-sm">{currTotal}</span> realizadas en {range} semanas</span>
        {delta != null && (
          <span className="inline-flex items-center gap-1 font-semibold"
            style={{ color: delta > 0 ? "#16A34A" : delta < 0 ? "#DC2626" : "#94A3B8" }}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)}%
            <span className="font-normal text-gray-400">vs {range} previas ({prevTotal})</span>
          </span>
        )}
      </div>

      {totalAll === 0 ? (
        <div className="h-36 flex items-center justify-center text-sm text-gray-400">Sin OT realizadas con fecha de ejecución.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={chart} barSize={range > 12 ? 14 : 26}
              onClick={(state: any) => {
                const idx = state?.activeTooltipIndex;
                if (idx == null || !chart[idx]) return;
                const key = chart[idx].key;
                setSelectedKey((prev) => (prev === key ? null : key));
              }}
              style={{ cursor: "pointer" }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "#F8FAFC" }} content={<ExecTooltip />} />
              <Bar dataKey="total" fill={REALIZADA_COLOR} name="Realizadas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Detalle de la semana seleccionada */}
          {selectedRow && (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">
                  Semana del {selectedRow.label} · {selectedRow.total} realizada{selectedRow.total === 1 ? "" : "s"}
                  {selectedRow.hours > 0 && <span className="font-normal text-gray-400"> · {selectedRow.hours}h</span>}
                </p>
                <button onClick={() => setSelectedKey(null)} className="text-gray-400 hover:text-gray-600 text-sm" title="Cerrar">×</button>
              </div>
              {selectedRow.items.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">Sin OT realizadas esa semana.</p>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {selectedRow.items.map((it: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: REALIZADA_COLOR }} />
                      {it.ot_number != null && <span className="font-mono text-gray-400 shrink-0">#{it.ot_number}</span>}
                      <span className="text-gray-800 truncate flex-1">{it.equipo ?? "—"}</span>
                      {it.hours != null && <span className="text-gray-400 shrink-0">{it.hours}h</span>}
                      <span className="text-gray-400 shrink-0">{new Date(it.executed_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExecTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-gray-700 mb-1">Semana del {row.label}</p>
      <div className="text-gray-500">
        Realizadas: <span className="font-semibold text-gray-800">{row.total}</span>
        {row.hours > 0 && <> · {row.hours}h</>}
      </div>
    </div>
  );
}
