"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import InfoTip from "@/app/components/InfoTip";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ESTADO: Record<string, { label: string; color: string; bg: string }> = {
  EN_PRODUCCION: { label: "En producción", color: "#16A34A", bg: "#DCFCE7" },
  PARCIAL:       { label: "Parcial",       color: "#B45309", bg: "#FEF3C7" },
  LIBRE:         { label: "Libre",         color: "#64748B", bg: "#F1F5F9" },
};
// Al tocar una celda, cicla entre estos
const CYCLE = ["LIBRE", "EN_PRODUCCION", "PARCIAL"];

// Lunes de la semana que contiene a `d`
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  return x;
}
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function fmt(d: Date) { return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }); }

export default function ProduccionClient({ sectors, canEdit }: { sectors: any[]; canEdit: boolean }) {
  // Por defecto, la semana que viene
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const m = mondayOf(new Date());
    m.setDate(m.getDate() + 7);
    return m;
  });
  // { sectorId: { days: string[7], note } }
  const [data, setData] = useState<Record<string, { days: string[]; note: string }>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const weekIso = iso(weekStart);
  const dayDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/produccion?week=${weekIso}`);
    const json = await res.json();
    const map: Record<string, { days: string[]; note: string }> = {};
    for (const row of json.data ?? []) {
      map[row.sector_id] = { days: row.days ?? Array(7).fill("LIBRE"), note: row.note ?? "" };
    }
    setData(map);
    setLoading(false);
  }, [weekIso]);

  useEffect(() => { load(); }, [load]);

  function getDays(sectorId: string): string[] {
    return data[sectorId]?.days ?? Array(7).fill("LIBRE");
  }

  async function persist(sectorId: string, days: string[], note: string) {
    if (!canEdit) return;
    setSavingId(sectorId);
    await fetch("/api/produccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: weekIso, sector_id: sectorId, days, note }),
    });
    setSavingId(null);
  }

  function cycleCell(sectorId: string, dayIdx: number) {
    if (!canEdit) return;
    const days = [...getDays(sectorId)];
    const cur = CYCLE.indexOf(days[dayIdx]);
    days[dayIdx] = CYCLE[(cur + 1) % CYCLE.length] ?? "LIBRE";
    const note = data[sectorId]?.note ?? "";
    setData((d) => ({ ...d, [sectorId]: { days, note } }));
    persist(sectorId, days, note);
  }

  function setNote(sectorId: string, note: string) {
    const days = getDays(sectorId);
    setData((d) => ({ ...d, [sectorId]: { days, note } }));
  }

  // Agrupar sectores por planta
  const byPlant = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const s of sectors) {
      const plant = s.plants?.name ?? "—";
      (groups[plant] ??= []).push(s);
    }
    return groups;
  }, [sectors]);

  // Días en que TODOS los sectores de una planta están libres → se puede reparar
  function plantFreeDays(plantSectors: any[]): boolean[] {
    return Array.from({ length: 7 }, (_, i) =>
      plantSectors.every((s) => getDays(s.id)[i] === "LIBRE")
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Planificación de producción
            <InfoTip text="Cargá qué sectores estarán en producción cada día de la semana. Los que queden 'Libres' son candidatos para reparación. Si una planta tiene todos sus sectores libres un día, se resalta: podés pararla sin frenar el despacho." />
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Tocá cada celda para cambiar el estado del día.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">‹</button>
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            Semana del {fmt(weekStart)}
          </span>
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">›</button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        {Object.entries(ESTADO).map(([k, m]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: m.bg, border: `1px solid ${m.color}44` }} />
            <span className="text-gray-600">{m.label}</span>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byPlant).map(([plant, plantSectors]) => {
            const freeDays = plantFreeDays(plantSectors);
            return (
              <div key={plant} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Syne', sans-serif" }}>{plant}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400">
                        <th className="text-left font-medium px-3 py-2 min-w-[140px]">Sector</th>
                        {DIAS.map((d, i) => (
                          <th key={d} className={`font-medium px-1 py-2 text-center ${freeDays[i] ? "text-green-600" : ""}`}>
                            <div>{d}</div>
                            <div className="text-[10px] text-gray-300">{fmt(dayDates[i])}</div>
                          </th>
                        ))}
                        <th className="text-left font-medium px-3 py-2 min-w-[140px]">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plantSectors.map((s) => {
                        const days = getDays(s.id);
                        return (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
                            {days.map((st, i) => {
                              const m = ESTADO[st] ?? ESTADO.LIBRE;
                              return (
                                <td key={i} className="px-1 py-1.5 text-center">
                                  <button onClick={() => cycleCell(s.id, i)} disabled={!canEdit}
                                    className="w-full min-w-[36px] h-8 rounded-md text-[10px] font-semibold transition-colors disabled:cursor-default"
                                    style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}33` }}
                                    title={m.label}>
                                    {st === "EN_PRODUCCION" ? "Prod" : st === "PARCIAL" ? "Parc" : "—"}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5">
                              <input
                                value={data[s.id]?.note ?? ""}
                                onChange={(e) => setNote(s.id, e.target.value)}
                                onBlur={(e) => canEdit && persist(s.id, getDays(s.id), e.target.value)}
                                disabled={!canEdit}
                                placeholder="—"
                                className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-amber-400" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Resumen de reparación */}
                {freeDays.some(Boolean) && (
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-green-50/50 text-xs text-green-700">
                    <span className="font-semibold">Planta libre (todos los sectores) — se puede reparar: </span>
                    {DIAS.filter((_, i) => freeDays[i]).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {savingId && <p className="text-xs text-gray-400 text-right">Guardando...</p>}
    </div>
  );
}
