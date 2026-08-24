"use client";

import { useEffect, useState, useCallback } from "react";
import { useConfirm } from "@/app/components/ConfirmProvider";
import InfoTip from "@/app/components/InfoTip";
import ComparativaModal from "./ComparativaModal";
import EnProcesoOSModal from "./EnProcesoOSModal";

const AREAS = ["Mantenimiento", "Taller Vial", "Producción", "Laboratorio", "Almacén", "Inversiones", "Despacho", "Cantera", "Otra"];
const EMPRESAS = ["Polcecal", "Polysan", "Ambas"];
const PRIORIDADES = ["URGENTE", "1 SEMANA", "NORMAL", "LEVE"];
const ESTADOS_OS = ["POR APROBAR", "EN PROCESO (COMPARATIVA)", "ACEPTADO", "EN PROCESO", "DENEGADO"];

function estadoColor(raw: string) {
  const v = (raw ?? "").toLowerCase();
  // Rojo: denegado/rechazado/anulado
  if (v.includes("deneg") || v.includes("rechaz") || v.includes("anul")) return { c: "#DC2626", b: "#FEF2F2" };
  // Ámbar (en trámite): por aprobar / pendiente / en curso / en proceso
  if (v.includes("por aprob") || v.includes("pend") || v.includes("curso") || v.includes("proces")) return { c: "#B45309", b: "#FFFBEB" };
  // Verde: aceptado / aprobado / realizado
  if (v.includes("acept") || v.includes("aprob") || v.includes("realiz")) return { c: "#16A34A", b: "#F0FDF4" };
  return { c: "#64748B", b: "#F1F5F9" };
}

const EMPTY = {
  area: "Mantenimiento", equipment_id: "", equipo_raw: "", sector_raw: "",
  descripcion: "", detalle_extra: "", prioridad: "NORMAL", empresa: "Polcecal",
  proveedor_elegido: "", estado: "PENDIENTE", observaciones: "",
};

export default function OrdenesServicioClient({ equipment, canEdit, canSync }: {
  equipment: any[]; canEdit: boolean; canSync: boolean;
}) {
  const confirm = useConfirm();
  const [rows, setRows]       = useState<any[]>([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [areaFilter, setAreaFilter] = useState("");
  const [search, setSearch]   = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [compOS, setCompOS] = useState<any | null>(null);
  const [enProcesoOS, setEnProcesoOS] = useState<any | null>(null);
  const [syncingComp, setSyncingComp] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (areaFilter) params.set("area", areaFilter);
    if (search)     params.set("q", search);
    params.set("page", String(page));
    const res = await fetch(`/api/ordenes-servicio?${params}`);
    const json = await res.json();
    setRows(json.data ?? []); setCount(json.count ?? 0);
    setLoading(false);
  }, [areaFilter, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/ordenes-servicio/sync").then(r => r.json()).then(d => setLastSync(d.last_sync)); }, []);

  async function sync() {
    const ok = await confirm({ title: "Sincronizar órdenes de servicio", message: "Se traerán las OS desde todas las pestañas de la planilla de Google Sheets. ¿Sincronizar?", confirmText: "Sincronizar" });
    if (!ok) return;
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/ordenes-servicio/sync", { method: "POST" });
    const d = await res.json();
    if (res.ok) { setSyncMsg(`✓ ${d.synced} OS sincronizadas`); setLastSync(new Date().toISOString()); load(); }
    else        { setSyncMsg(`Error: ${d.error}`); }
    setSyncing(false);
  }

  async function syncComparativas() {
    const ok = await confirm({ title: "Sincronizar comparativas", message: "Se importarán/actualizarán las comparativas desde todas las pestañas (sectores) de la planilla de comparativas. ¿Sincronizar?", confirmText: "Sincronizar" });
    if (!ok) return;
    setSyncingComp(true); setSyncMsg("");
    const res = await fetch("/api/comparativas/sync", { method: "POST" });
    const d = await res.json();
    if (res.ok) setSyncMsg(`✓ ${d.synced} cotizaciones sincronizadas`);
    else        setSyncMsg(`Error: ${d.error}`);
    setSyncingComp(false);
  }

  const [estadoBusy, setEstadoBusy] = useState<string | null>(null);
  async function changeEstado(o: any, estado: string) {
    if (estado === o.estado) return;
    setEstadoBusy(o.id);
    const res = await fetch("/api/ordenes-servicio", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: o.id, estado }),
    });
    setEstadoBusy(null);
    if (res.ok) { setRows((rs) => rs.map((r) => (r.id === o.id ? { ...r, estado } : r))); }
  }

  const [busyFecha, setBusyFecha] = useState<string | null>(null);
  async function updateFecha(o: any, field: "fecha_pedido" | "fecha_realizacion", value: string) {
    setBusyFecha(o.id);
    const res = await fetch("/api/ordenes-servicio", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: o.id, [field]: value || null }),
    });
    setBusyFecha(null);
    if (res.ok) setRows((rs) => rs.map((r) => (r.id === o.id ? { ...r, [field]: value || null } : r)));
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descripcion.trim()) { setError("La descripción es obligatoria."); return; }
    setSaving(true); setError("");
    const eq = equipment.find((x) => x.id === form.equipment_id);
    const res = await fetch("/api/ordenes-servicio", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        equipo_raw: eq ? `${eq.code} – ${eq.name}` : form.equipo_raw,
        sector_raw: eq?.sectors?.name ?? form.sector_raw,
        sector_id:  eq?.sector_id ?? null,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setError(d.error ?? "Error al crear"); return; }
    setShowNew(false); setForm({ ...EMPTY }); load();
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Órdenes de Servicio
            <InfoTip text="Pedidos de servicio o compra externa por área (proveedor, costo, orden de compra, estado). Se sincronizan con la planilla de Google Sheets (una pestaña por área). Podés filtrarlas por área y crear nuevas." />
          </h1>
          {lastSync && <p className="text-xs text-gray-400 mt-0.5">Última sync: {new Date(lastSync).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && <span className={`text-sm ${syncMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{syncMsg}</span>}
          {canEdit && (
            <button onClick={() => { setForm({ ...EMPTY }); setError(""); setShowNew(true); }}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">+ Nueva OS</button>
          )}
          {canSync && (
            <button onClick={sync} disabled={syncing} className="flex items-center gap-2 btn-primary disabled:opacity-50">
              <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Sincronizando..." : "Sync OS"}
            </button>
          )}
          {canSync && (
            <button onClick={syncComparativas} disabled={syncingComp}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              <svg className={`w-4 h-4 ${syncingComp ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncingComp ? "Sincronizando..." : "Sync comparativas"}
            </button>
          )}
        </div>
      </div>

      {/* Filtros por área */}
      <div className="flex gap-2 flex-wrap">
        {["", ...AREAS].map((a) => (
          <button key={a || "todas"} onClick={() => { setAreaFilter(a); setPage(1); }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-all ${areaFilter === a ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
            {a || "Todas"}
          </button>
        ))}
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar N° OS, equipo, proveedor, descripción..."
          className="w-full sm:w-64 sm:ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400" />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">{lastSync ? "No hay OS con esos filtros." : "Aún no se sincronizaron OS."}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            {count} órdenes de servicio
            {count > 50 && <> · mostrando {(page - 1) * 50 + 1}–{Math.min(page * 50, count)}</>}
          </p>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
            {rows.map((o) => {
              const est = estadoColor(o.estado);
              const seg = seguimientoBadge(o);
              const isOpen = expanded === o.id;
              return (
                <div key={o.id}>
                  <button onClick={() => setExpanded(isOpen ? null : o.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
                    <span className="text-xs font-mono font-bold text-gray-400 w-12 shrink-0">#{o.os_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{o.descripcion ?? "—"}</p>
                      <p className="text-xs text-gray-400 truncate">{[o.area, o.equipo_raw, o.proveedor_elegido].filter(Boolean).join(" · ")}</p>
                    </div>
                    {o.costo != null && <span className="text-xs text-gray-500 shrink-0 hidden md:block">${Number(o.costo).toLocaleString("es-AR")}</span>}
                    {seg && <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full hidden sm:inline" style={{ color: seg.c, background: seg.b }} title={seg.title}>{seg.label}</span>}
                    {o.estado && <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: est.c, background: est.b }}>{o.estado}</span>}
                    <svg className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                      <D label="Área" v={o.area} /><D label="Sector" v={o.sector_raw} /><D label="Equipo" v={o.equipo_raw} />
                      <D label="Empresa" v={o.empresa} /><D label="Prioridad" v={o.prioridad} /><D label="Proveedor" v={o.proveedor_elegido} />
                      <D label="Costo" v={o.costo != null ? `$${Number(o.costo).toLocaleString("es-AR")}` : null} />
                      <D label="Orden de compra" v={o.tiene_orden_compra} /><D label="CUIT" v={o.cuit} />
                      <D label="Fecha req." v={o.fecha_requerimiento ? new Date(o.fecha_requerimiento).toLocaleDateString("es-AR") : null} />
                      {o.detalle_extra && <div className="col-span-2 md:col-span-3"><D label="Detalle" v={o.detalle_extra} /></div>}
                      {o.observaciones && <div className="col-span-2 md:col-span-3"><D label="Observaciones" v={o.observaciones} /></div>}
                      {o.imagen && <div className="col-span-2 md:col-span-3"><a href={o.imagen} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Ver imagen adjunta</a></div>}
                      {o.comparativa && o.comparativa !== "LINK" && <div className="col-span-2 md:col-span-3"><a href={o.comparativa} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">Comparativa</a></div>}
                      {/* Seguimiento: fecha de pedido y de cierre + demora */}
                      <div className="col-span-2 md:col-span-3 rounded-lg border border-gray-200 bg-white p-3 mt-1">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Seguimiento</p>
                        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                          <FechaSeguimiento label="Fecha de pedido" value={o.fecha_pedido} canEdit={canEdit}
                            busy={busyFecha === o.id} onSet={(v) => updateFecha(o, "fecha_pedido", v)} />
                          <FechaSeguimiento label="Fecha de cierre / recepción" value={o.fecha_realizacion} canEdit={canEdit}
                            busy={busyFecha === o.id} onSet={(v) => updateFecha(o, "fecha_realizacion", v)} />
                          <div className="text-xs">
                            <p className="text-gray-400 mb-0.5">Demora</p>
                            <p className="font-semibold" style={{ color: demoraInfo(o).c }}>{demoraInfo(o).text}</p>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2 md:col-span-3 pt-1">
                        <button onClick={() => setCompOS(o)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                          Comparativa de proveedores
                        </button>
                      </div>
                      {canEdit && (
                        <div className="col-span-2 md:col-span-3 flex items-center gap-2 pt-1 flex-wrap">
                          <span className="text-xs text-gray-500 font-medium">Cambiar estado:</span>
                          {ESTADOS_OS.map((s) => {
                            const m = estadoColor(s);
                            const active = (o.estado ?? "").toUpperCase() === s;
                            return (
                              <button key={s} onClick={() => s === "EN PROCESO" ? setEnProcesoOS(o) : changeEstado(o, s)}
                                disabled={active || estadoBusy === o.id}
                                className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-all disabled:opacity-40"
                                style={{ color: m.c, background: m.b, borderColor: m.c + "44" }}>
                                {s}
                              </button>
                            );
                          })}
                          {estadoBusy === o.id && <span className="text-xs text-gray-400">Guardando...</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {count > 50 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">← Anterior</button>
              <span className="text-sm text-gray-500">{page} / {Math.ceil(count / 50)}</span>
              <button onClick={() => setPage((p) => Math.min(Math.ceil(count / 50), p + 1))} disabled={page >= Math.ceil(count / 50)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">Siguiente →</button>
            </div>
          )}
        </>
      )}

      {/* Comparativa de proveedores */}
      {compOS && <ComparativaModal os={compOS} canEdit={canEdit} onClose={() => setCompOS(null)} />}

      {/* Pasar a En proceso (elige proveedor de la comparativa) */}
      {enProcesoOS && (
        <EnProcesoOSModal
          os={enProcesoOS}
          onClose={() => setEnProcesoOS(null)}
          onDone={(proveedor) => {
            setRows((rs) => rs.map((r) => (r.id === enProcesoOS.id ? { ...r, estado: "EN PROCESO", proveedor_elegido: proveedor } : r)));
            setEnProcesoOS(null);
          }}
        />
      )}

      {/* Nueva OS */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <form onSubmit={crear} className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">Nueva orden de servicio</h2>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Área"><select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input">{AREAS.map((a) => <option key={a}>{a}</option>)}</select></Fld>
              <Fld label="Empresa"><select value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="input">{EMPRESAS.map((a) => <option key={a}>{a}</option>)}</select></Fld>
            </div>
            <Fld label="Equipo">
              <select value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })} className="input">
                <option value="">— Sin equipo / manual —</option>
                {equipment.map((e: any) => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
              </select>
            </Fld>
            {!form.equipment_id && (
              <Fld label="Equipo (texto libre)"><input value={form.equipo_raw} onChange={(e) => setForm({ ...form, equipo_raw: e.target.value })} className="input" placeholder="Opcional" /></Fld>
            )}
            <Fld label="Descripción *"><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} className="input resize-none" /></Fld>
            <Fld label="Detalle extra"><textarea value={form.detalle_extra} onChange={(e) => setForm({ ...form, detalle_extra: e.target.value })} rows={2} className="input resize-none" /></Fld>
            <div className="grid grid-cols-2 gap-3">
              <Fld label="Prioridad"><select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="input">{PRIORIDADES.map((p) => <option key={p}>{p}</option>)}</select></Fld>
              <Fld label="Proveedor elegido"><input value={form.proveedor_elegido} onChange={(e) => setForm({ ...form, proveedor_elegido: e.target.value })} className="input" /></Fld>
            </div>
            <Fld label="Observaciones"><input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className="input" /></Fld>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Guardando..." : "Crear OS"}</button>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            </div>
            <p className="text-xs text-gray-400">Se agrega también a la pestaña «{form.area}» de la planilla.</p>
          </form>
        </div>
      )}
    </div>
  );
}

function D({ label, v }: { label: string; v?: string | null }) {
  if (!v) return null;
  return <div><p className="text-xs text-gray-400">{label}</p><p className="text-sm text-gray-700">{v}</p></div>;
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="block text-xs font-medium text-gray-600">{label}</label>{children}</div>;
}

// ── Seguimiento (pedido → cierre) ───────────────────────────────────────────────
function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function daysBetween(a: string, b: string): number {
  const ms = new Date(b.slice(0, 10)).getTime() - new Date(a.slice(0, 10)).getTime();
  return Math.round(ms / 86400000);
}

// Una OS ACEPTADA o DENEGADA se considera resuelta (cerrada), aunque no tenga
// fecha de cierre: no vuelve a figurar como abierta/pendiente. (POR APROBAR y
// EN PROCESO siguen abiertas.)
function esResuelta(estado: string): boolean {
  const e = (estado ?? "").toLowerCase();
  if (e.includes("por aprob")) return false;
  return e.includes("acept") || e.includes("deneg") || e.includes("rechaz") ||
         e.includes("anul") || e.includes("realiz") || e.includes("aprob");
}

// Badge compacto para la fila de la lista.
function seguimientoBadge(o: any): { label: string; c: string; b: string; title: string } | null {
  const pedido = o.fecha_pedido, cierre = o.fecha_realizacion;
  if (cierre) {
    const d = pedido ? daysBetween(pedido, cierre) : null;
    return { label: d != null ? `✓ ${d} d` : "✓ cerrada", c: "#16A34A", b: "#F0FDF4", title: d != null ? `Cerrada en ${d} días` : "Cerrada" };
  }
  // Resuelta (aceptada/denegada) sin fecha de cierre → cerrada, no abierta.
  if (esResuelta(o.estado)) return null;
  if (pedido) {
    const d = daysBetween(pedido, todayISO());
    return { label: `⏳ ${d} d`, c: "#B45309", b: "#FFFBEB", title: `Pendiente · ${d} días desde el pedido` };
  }
  return null;
}

// Texto de demora para el detalle.
function demoraInfo(o: any): { text: string; c: string } {
  const pedido = o.fecha_pedido, cierre = o.fecha_realizacion;
  if (pedido && cierre) return { text: `${daysBetween(pedido, cierre)} días`, c: "#16A34A" };
  if (!cierre && esResuelta(o.estado)) return { text: "Cerrada (resuelta)", c: "#16A34A" };
  if (pedido && !cierre) return { text: `Pendiente · ${daysBetween(pedido, todayISO())} días desde el pedido`, c: "#B45309" };
  if (!pedido && cierre) return { text: "Cerrada (sin fecha de pedido)", c: "#64748B" };
  return { text: "Sin pedido registrado", c: "#94A3B8" };
}

function FechaSeguimiento({ label, value, canEdit, busy, onSet }: {
  label: string; value: string | null; canEdit: boolean; busy: boolean; onSet: (v: string) => void;
}) {
  const iso = value ? value.slice(0, 10) : "";
  return (
    <div className="text-xs">
      <p className="text-gray-400 mb-0.5">{label}</p>
      {canEdit ? (
        <div className="flex items-center gap-1.5">
          <input type="date" value={iso} disabled={busy} onChange={(e) => onSet(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-amber-400 disabled:opacity-50" />
          {!iso ? (
            <button onClick={() => onSet(todayISO())} disabled={busy}
              className="rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">Sellar hoy</button>
          ) : (
            <button onClick={() => onSet("")} disabled={busy} className="text-gray-300 hover:text-red-600" title="Quitar fecha">×</button>
          )}
        </div>
      ) : (
        <p className="text-gray-700 font-medium">{iso ? new Date(iso).toLocaleDateString("es-AR") : "—"}</p>
      )}
    </div>
  );
}
