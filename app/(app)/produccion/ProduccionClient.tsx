"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import InfoTip from "@/app/components/InfoTip";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const TURNOS = ["M", "T", "N"]; // Mañana / Tarde / Noche

const ESTADO: Record<string, { label: string; short: string; color: string; bg: string }> = {
  EN_PRODUCCION: { label: "En producción", short: "Prod", color: "#16A34A", bg: "#DCFCE7" },
  PARCIAL:       { label: "Parcial",       short: "Parc", color: "#B45309", bg: "#FEF3C7" },
  LIBRE:         { label: "Libre",         short: "—",    color: "#64748B", bg: "#F1F5F9" },
};
const ESTADO_OPTS = ["LIBRE", "EN_PRODUCCION", "PARCIAL"];

type Rec = { days: string[]; note: string; motivos: string[]; turnos: string[]; responsable: string };
const emptyRec = (): Rec => ({ days: Array(7).fill("LIBRE"), note: "", motivos: Array(7).fill(""), turnos: Array(7).fill(""), responsable: "" });

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

export default function ProduccionClient({ sectors, canEdit, pendOT = [], pendOS = [] }: {
  sectors: any[]; canEdit: boolean; pendOT?: any[]; pendOS?: any[];
}) {
  // Por defecto, la semana que viene
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const m = mondayOf(new Date());
    m.setDate(m.getDate() + 7);
    return m;
  });
  const [data, setData] = useState<Record<string, Rec>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editCell, setEditCell] = useState<{ sectorId: string; dayIdx: number } | null>(null);
  const [turnoFilter, setTurnoFilter] = useState<string>(""); // "" | "M" | "T" | "N"
  const [pendSector, setPendSector] = useState<any | null>(null);

  // Mantenimiento pendiente por sector (para cruzar con las ventanas libres)
  const otBySector = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const o of pendOT) (m[o.sector_id] ??= []).push(o);
    return m;
  }, [pendOT]);
  const osBySector = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const o of pendOS) (m[o.sector_id] ??= []).push(o);
    return m;
  }, [pendOS]);
  const pendCount = (sectorId: string) => (otBySector[sectorId]?.length ?? 0) + (osBySector[sectorId]?.length ?? 0);
  // Sectores con una OT pendiente que requiere pararlos
  const paradaSectores = useMemo(() => {
    const s = new Set<string>();
    for (const o of pendOT) if (o.requiere_parada_sector) s.add(o.sector_id);
    return s;
  }, [pendOT]);

  const weekIso = iso(weekStart);
  const dayDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }),
    [weekStart]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/produccion?week=${weekIso}`);
    const json = await res.json();
    const map: Record<string, Rec> = {};
    for (const row of json.data ?? []) {
      map[row.sector_id] = {
        days: row.days ?? Array(7).fill("LIBRE"),
        note: row.note ?? "",
        motivos: row.motivos ?? Array(7).fill(""),
        turnos: row.turnos ?? Array(7).fill(""),
        responsable: row.responsable ?? "",
      };
    }
    setData(map);
    setLoading(false);
  }, [weekIso]);

  useEffect(() => { load(); }, [load]);

  const getRec = useCallback((sectorId: string): Rec => data[sectorId] ?? emptyRec(), [data]);

  const persistSector = useCallback(async (sectorId: string, rec: Rec) => {
    if (!canEdit) return;
    setSavingId(sectorId);
    await fetch("/api/produccion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        week_start: weekIso, sector_id: sectorId,
        days: rec.days, note: rec.note, motivos: rec.motivos, turnos: rec.turnos, responsable: rec.responsable,
      }),
    });
    setSavingId(null);
  }, [canEdit, weekIso]);

  function updateSector(sectorId: string, patch: Partial<Rec>, persist = true) {
    const rec = { ...getRec(sectorId), ...patch };
    setData((d) => ({ ...d, [sectorId]: rec }));
    if (persist) persistSector(sectorId, rec);
  }

  function saveCell(estado: string, turnos: string, motivo: string) {
    if (!editCell) return;
    const { sectorId, dayIdx } = editCell;
    const rec = getRec(sectorId);
    const days = [...rec.days];       days[dayIdx] = estado;
    const turnosArr = [...rec.turnos]; turnosArr[dayIdx] = turnos;
    const motivos = [...rec.motivos]; motivos[dayIdx] = motivo;
    updateSector(sectorId, { days, turnos: turnosArr, motivos });
    setEditCell(null);
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
      plantSectors.every((s) => getRec(s.id).days[i] === "LIBRE")
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Planificación de producción
            <InfoTip text="Cargá qué sectores estarán en producción cada día. Tocá una celda para elegir estado, turnos y (si hay parada) el motivo. Los días 'Libres' son candidatos para reparación; si toda una planta queda libre un día, se resalta." />
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{canEdit ? "Tocá cada celda para editar el día." : "Vista de solo lectura."}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">‹</button>
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">Semana del {fmt(weekStart)}</span>
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
        <span className="text-gray-400">· Turnos: M (mañana) / T (tarde) / N (noche)</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-gray-400">Filtrar turno:</span>
          {[{ v: "", l: "Todos" }, { v: "M", l: "Mañana" }, { v: "T", l: "Tarde" }, { v: "N", l: "Noche" }].map((o) => (
            <button key={o.v || "todos"} onClick={() => setTurnoFilter(o.v)}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${turnoFilter === o.v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:text-gray-700"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byPlant).map(([plant, plantSectors]) => {
            const freeDays = plantFreeDays(plantSectors);
            // Filtro por turno: solo sectores que trabajan ese turno algún día
            const visibleSectors = turnoFilter
              ? plantSectors.filter((s) => getRec(s.id).turnos.some((t) => (t ?? "").includes(turnoFilter)))
              : plantSectors;
            if (turnoFilter && visibleSectors.length === 0) return null;
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
                        <th className="text-left font-medium px-3 py-2 min-w-[120px]">Responsable</th>
                        <th className="text-left font-medium px-3 py-2 min-w-[140px]">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSectors.map((s) => {
                        const rec = getRec(s.id);
                        return (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium text-gray-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{s.name}</span>
                                {paradaSectores.has(s.id) && (
                                  <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-600"
                                    title="Hay una OT pendiente que requiere parar este sector">⛔ Parar</span>
                                )}
                                {pendCount(s.id) > 0 && (
                                  <button onClick={() => setPendSector(s)}
                                    className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                                    title="Mantenimiento pendiente en este sector">
                                    🔧 {pendCount(s.id)}
                                  </button>
                                )}
                              </div>
                            </td>
                            {rec.days.map((st, i) => {
                              const m = ESTADO[st] ?? ESTADO.LIBRE;
                              const turno = rec.turnos[i] ?? "";
                              const motivo = rec.motivos[i] ?? "";
                              const dim = turnoFilter && !turno.includes(turnoFilter); // no trabaja ese turno ese día
                              return (
                                <td key={i} className="px-1 py-1.5 text-center align-top">
                                  <button onClick={() => canEdit && setEditCell({ sectorId: s.id, dayIdx: i })} disabled={!canEdit}
                                    className="w-full min-w-[44px] rounded-md py-1 transition-colors disabled:cursor-default"
                                    style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}33`, opacity: dim ? 0.3 : 1 }}
                                    title={[m.label, turno && `Turnos: ${turno}`, motivo && `Motivo: ${motivo}`].filter(Boolean).join(" · ")}>
                                    <div className="text-[10px] font-semibold leading-tight">{m.short}</div>
                                    {turno && <div className="text-[9px] leading-tight opacity-80">{turno.split("").join("·")}</div>}
                                    {motivo && <div className="text-[9px] leading-none">•</div>}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5">
                              <input value={rec.responsable}
                                onChange={(e) => updateSector(s.id, { responsable: e.target.value }, false)}
                                onBlur={(e) => canEdit && persistSector(s.id, { ...getRec(s.id), responsable: e.target.value })}
                                disabled={!canEdit} placeholder="—"
                                className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-amber-400 disabled:bg-transparent disabled:border-transparent" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input value={rec.note}
                                onChange={(e) => updateSector(s.id, { note: e.target.value }, false)}
                                onBlur={(e) => canEdit && persistSector(s.id, { ...getRec(s.id), note: e.target.value })}
                                disabled={!canEdit} placeholder="—"
                                className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs outline-none focus:border-amber-400 disabled:bg-transparent disabled:border-transparent" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Resumen de reparación */}
                {freeDays.some(Boolean) && (() => {
                  const plantPend = plantSectors.reduce((a, s) => a + pendCount(s.id), 0);
                  return (
                    <div className="px-4 py-2.5 border-t border-gray-100 bg-green-50/50 text-xs text-green-700 space-y-0.5">
                      <div>
                        <span className="font-semibold">Planta libre (todos los sectores) — se puede reparar: </span>
                        {DIAS.filter((_, i) => freeDays[i]).join(", ")}
                      </div>
                      {plantPend > 0 && (
                        <div className="text-amber-700">
                          🔧 <span className="font-semibold">Aprovechá la ventana:</span> hay {plantPend} pendiente{plantPend === 1 ? "" : "s"} de mantenimiento en esta planta.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {savingId && <p className="text-xs text-gray-400 text-right">Guardando...</p>}

      {/* Pendientes de mantenimiento del sector */}
      {pendSector && (
        <PendientesSector
          sectorName={pendSector.name}
          ot={otBySector[pendSector.id] ?? []}
          os={osBySector[pendSector.id] ?? []}
          onClose={() => setPendSector(null)}
        />
      )}

      {/* Editor de día */}
      {editCell && (() => {
        const rec = getRec(editCell.sectorId);
        const sector = sectors.find((s) => s.id === editCell.sectorId);
        return (
          <DiaEditor
            sectorName={sector?.name ?? ""}
            dayLabel={`${DIAS[editCell.dayIdx]} ${fmt(dayDates[editCell.dayIdx])}`}
            estado={rec.days[editCell.dayIdx]}
            turnos={rec.turnos[editCell.dayIdx] ?? ""}
            motivo={rec.motivos[editCell.dayIdx] ?? ""}
            onSave={saveCell}
            onClose={() => setEditCell(null)}
          />
        );
      })()}
    </div>
  );
}

function PendientesSector({ sectorName, ot, os, onClose }: {
  sectorName: string; ot: any[]; os: any[]; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>Pendiente en {sectorName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Para aprovechar la ventana de parada.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Órdenes de trabajo ({ot.length})</p>
          {ot.length === 0 ? <p className="text-xs text-gray-400">Sin OT pendientes.</p> : (
            <div className="space-y-1">
              {ot.map((o, i) => (
                <a key={i} href={`/ordenes?estado=${o.estado}`} className="block rounded-lg border border-gray-100 px-2.5 py-1.5 text-xs hover:bg-gray-50">
                  <span className="font-mono text-gray-400">#{o.ot_number}</span>{" "}
                  <span className="text-gray-800">{o.descripcion ?? o.equipo_raw ?? "—"}</span>
                  {o.prioridad && <span className="ml-1 text-gray-400">· {o.prioridad}</span>}
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Órdenes de servicio ({os.length})</p>
          {os.length === 0 ? <p className="text-xs text-gray-400">Sin OS activas.</p> : (
            <div className="space-y-1">
              {os.map((o, i) => (
                <div key={i} className="rounded-lg border border-gray-100 px-2.5 py-1.5 text-xs">
                  <span className="font-mono text-gray-400">#{o.os_number}</span>{" "}
                  <span className="text-gray-800">{o.descripcion ?? "—"}</span>
                  {o.estado && <span className="ml-1 text-gray-400">· {o.estado}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiaEditor({ sectorName, dayLabel, estado, turnos, motivo, onSave, onClose }: {
  sectorName: string; dayLabel: string; estado: string; turnos: string; motivo: string;
  onSave: (estado: string, turnos: string, motivo: string) => void; onClose: () => void;
}) {
  const [est, setEst] = useState(estado);
  const [tur, setTur] = useState(turnos);
  const [mot, setMot] = useState(motivo);
  const toggleTurno = (t: string) => setTur((prev) => prev.includes(t) ? prev.replace(t, "") : TURNOS.filter((x) => (prev + t).includes(x)).join(""));

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>{sectorName}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{dayLabel}</p>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Estado</label>
          <div className="grid grid-cols-3 gap-2">
            {ESTADO_OPTS.map((k) => {
              const m = ESTADO[k];
              const sel = est === k;
              return (
                <button key={k} onClick={() => setEst(k)}
                  className="rounded-xl border-2 px-2 py-2 text-xs font-semibold transition-all"
                  style={{ borderColor: sel ? m.color : "#E2E8F0", background: sel ? m.bg : "#fff", color: sel ? m.color : "#64748B" }}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Turnos</label>
          <div className="flex gap-2">
            {TURNOS.map((t) => {
              const sel = tur.includes(t);
              const nombre = t === "M" ? "Mañana" : t === "T" ? "Tarde" : "Noche";
              return (
                <button key={t} onClick={() => toggleTurno(t)}
                  className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-semibold transition-all ${sel ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-500"}`}>
                  {nombre}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            Motivo de parada {est !== "EN_PRODUCCION" ? "" : <span className="text-gray-400">(opcional)</span>}
          </label>
          <input value={mot} onChange={(e) => setMot(e.target.value)}
            placeholder={est === "EN_PRODUCCION" ? "Sin parada" : "Mantenimiento, falta de insumo, feriado..."}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave(est, tur, mot)} className="btn-primary">Guardar</button>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
