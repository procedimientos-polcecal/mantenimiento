"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import NuevaOTModal from "./NuevaOTModal";
import RepuestosOTModal from "./RepuestosOTModal";
import RegistrarOTModal from "./RegistrarOTModal";
import { useConfirm } from "@/app/components/ConfirmProvider";
import InfoTip from "@/app/components/InfoTip";

const ESTADOS = [
  { value: "",           label: "Todos",      color: "#64748B", bg: "#F8FAFC", dot: "#94A3B8" },
  { value: "PENDIENTES", label: "Pendientes", color: "#B45309", bg: "#FFFBEB", dot: "#F59E0B" },
  { value: "ATRASADO",   label: "Atrasado",   color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
  { value: "EN_PROCESO", label: "En proceso", color: "#1D4ED8", bg: "#EFF6FF", dot: "#3B82F6" },
  { value: "POR_HACER",  label: "Por hacer",  color: "#B45309", bg: "#FFFBEB", dot: "#F59E0B" },
  { value: "REALIZADO",  label: "Realizado",  color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E" },
];

export function estadoMeta(v: string) {
  return ESTADOS.find((e) => e.value === v) ?? { label: v, color: "#64748B", bg: "#F8FAFC", dot: "#94A3B8" };
}

const SORT_OPTIONS = [
  { value: "numero",    label: "N° OT (recientes)" },
  { value: "sugerido",  label: "Sugerido" },
  { value: "prioridad", label: "Prioridad" },
  { value: "estado",    label: "Estado (atrasadas primero)" },
  { value: "fecha",     label: "Antigüedad" },
  { value: "manual",    label: "Manual (arrastrar)" },
];

const PRIO_W:   Record<string, number> = { ALTA: 3, MEDIA: 2, BAJA: 1 };
const ESTADO_W: Record<string, number> = { ATRASADO: 4, EN_PROCESO: 3, POR_HACER: 2, SUSPENDIDA: 1, REALIZADO: 0 };
const CRIT_W:   Record<string, number> = { ALTA: 3, MEDIA: 2, BAJA: 1 };
const wOf = (m: Record<string, number>, v: any) => m[(v ?? "").toString().toUpperCase()] ?? 0;
const cmpFecha = (a: any, b: any) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999");

export default function OrdenesClient({
  canSync, canEdit, sectors, equipment,
}: {
  canSync: boolean;
  canEdit: boolean;
  sectors: any[];
  equipment: any[];
}) {
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [orders, setOrders]     = useState<any[]>([]);
  const [count, setCount]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncMsg, setSyncMsg]   = useState("");
  const [estadoFilter, setEstadoFilter] = useState(searchParams.get("estado") ?? "");
  // Filtros de drill-down desde el dashboard (tipo de trabajo / ejecución).
  const [tipoFilter, setTipoFilter]   = useState(searchParams.get("tipo") ?? "");
  const [quienFilter, setQuienFilter] = useState(searchParams.get("quien") ?? "");
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [view, setView]         = useState<"list" | "kanban">("list");
  const [sortMode, setSortMode] = useState("numero");
  const [manualList, setManualList] = useState<any[]>([]);
  const [dragIdx, setDragIdx]   = useState<number | null>(null);

  const prioritizing = view === "list" && sortMode !== "numero";

  // Kanban: cada columna se carga por separado (con su propio filtro y total)
  const [kanbanData, setKanbanData] = useState<Record<string, { items: any[]; count: number }>>({});
  const [kanbanLoading, setKanbanLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    // Modo priorización: trae las pendientes (no realizadas) sin paginar
    if (view === "list" && sortMode !== "numero") params.set("pendientes", "1");
    else params.set("page", String(page));
    if (estadoFilter) params.set("estado", estadoFilter);
    if (tipoFilter)   params.set("tipo", tipoFilter);
    if (quienFilter)  params.set("quien", quienFilter);
    if (search)       params.set("q", search);
    const res = await fetch(`/api/work-orders?${params}`);
    const json = await res.json();
    setOrders(json.data ?? []);
    setCount(json.count ?? (json.data?.length ?? 0));
    setLoading(false);
  }, [page, estadoFilter, tipoFilter, quienFilter, search, sortMode, view]);

  const KANBAN_ESTADOS = ["ATRASADO", "EN_PROCESO", "POR_HACER", "REALIZADO"];
  const loadKanban = useCallback(async () => {
    setKanbanLoading(true);
    const results = await Promise.all(
      KANBAN_ESTADOS.map((e) =>
        fetch(`/api/work-orders?estado=${e}&page=1`).then((r) => r.json())
      )
    );
    const data: Record<string, { items: any[]; count: number }> = {};
    KANBAN_ESTADOS.forEach((e, i) => {
      data[e] = { items: results[i].data ?? [], count: results[i].count ?? 0 };
    });
    setKanbanData(data);
    setKanbanLoading(false);
  }, []);

  useEffect(() => {
    if (view === "kanban") loadKanban();
    else load();
  }, [view, load, loadKanban]);

  useEffect(() => {
    fetch("/api/work-orders/sync")
      .then(r => r.json())
      .then(d => setLastSync(d.last_sync));
  }, []);

  async function sync() {
    const ok = await confirm({
      title: "Sincronizar con Google Sheets",
      message: "Se traerán las órdenes de trabajo desde la planilla de Google Sheets y se actualizarán las de la app. Los datos de la planilla tienen prioridad. ¿Sincronizar ahora?",
      confirmText: "Sincronizar",
    });
    if (!ok) return;
    setSyncing(true); setSyncMsg("");
    const res  = await fetch("/api/work-orders/sync", { method: "POST" });
    const data = await res.json();
    if (res.ok) { setSyncMsg(`✓ ${data.synced} órdenes sincronizadas`); setLastSync(new Date().toISOString()); load(); }
    else        { setSyncMsg(`Error: ${data.error}`); }
    setSyncing(false);
  }

  // Al elegir un nuevo estado se abre el modal de registro (ejecución + operarios)
  const [regModal, setRegModal] = useState<{ order: any; estado: string } | null>(null);
  async function openRegistrar(order: any, estado: string) {
    // La ventana de registro (operarios/horas/checklist/fotos) solo aparece al marcar REALIZADO.
    if (estado === "REALIZADO") { setRegModal({ order, estado }); return; }
    // Otros estados: cambio directo, sin ventana de registro.
    await fetch("/api/work-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, estado }),
    });
    if (view === "kanban") loadKanban(); else load();
  }
  function onRegistroDone() {
    setRegModal(null);
    if (view === "kanban") loadKanban(); else load();
  }

  const totalPages = Math.ceil(count / 50);

  // ── Ordenamiento (priorización) ────────────────────────────────────────────
  const sortedOrders = useMemo(() => {
    const arr = [...orders];
    switch (sortMode) {
      case "sugerido":
        arr.sort((a, b) =>
          wOf(ESTADO_W, b.estado) - wOf(ESTADO_W, a.estado)
          || wOf(PRIO_W, b.prioridad) - wOf(PRIO_W, a.prioridad)
          || wOf(CRIT_W, b.equipment?.criticality) - wOf(CRIT_W, a.equipment?.criticality)
          || cmpFecha(a, b));
        break;
      case "prioridad":
        arr.sort((a, b) => wOf(PRIO_W, b.prioridad) - wOf(PRIO_W, a.prioridad)
          || wOf(ESTADO_W, b.estado) - wOf(ESTADO_W, a.estado) || cmpFecha(a, b));
        break;
      case "estado":
        arr.sort((a, b) => wOf(ESTADO_W, b.estado) - wOf(ESTADO_W, a.estado)
          || wOf(PRIO_W, b.prioridad) - wOf(PRIO_W, a.prioridad));
        break;
      case "fecha":
        arr.sort(cmpFecha);
        break;
      case "manual":
        arr.sort((a, b) => (a.orden_manual ?? 1e9) - (b.orden_manual ?? 1e9) || b.ot_number - a.ot_number);
        break;
    }
    return arr;
  }, [orders, sortMode]);

  // El modo manual usa una lista mutable propia (para arrastrar)
  useEffect(() => {
    if (sortMode === "manual") setManualList(sortedOrders);
  }, [sortMode, sortedOrders]);

  async function persistOrder(arr: any[]) {
    await fetch("/api/work-orders/orden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: arr.map((o, idx) => ({ id: o.id, orden: idx })) }),
    });
  }
  function onDrop(i: number) {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); return; }
    const arr = [...manualList];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(i, 0, moved);
    setManualList(arr);
    setDragIdx(null);
    persistOrder(arr);
  }

  const listOrders = sortMode === "manual" ? manualList : sortedOrders;

  // Kanban groups — cada columna con sus items cargados y su total real
  const kanbanGroups = ESTADOS.slice(1).map(e => ({
    ...e,
    items: kanbanData[e.value]?.items ?? [],
    count: kanbanData[e.value]?.count ?? 0,
  }));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Órdenes de Trabajo
            <InfoTip text="Listado de todas las órdenes de trabajo (OT). Se sincronizan con la planilla de Google Sheets en ambos sentidos. Podés verlas como lista o como tablero Kanban por estado, filtrarlas, crear nuevas y cambiar su estado (Por hacer, En proceso, Atrasado, Realizado)." />
          </h1>
          {lastSync && (
            <p className="text-xs text-gray-400 mt-0.5">
              Última sync: {new Date(lastSync).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && (
            <span className={`text-sm ${syncMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {syncMsg}
            </span>
          )}
          {canEdit && (
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva OT
            </button>
          )}
          {canSync && (
            <button onClick={sync} disabled={syncing}
              className="flex items-center gap-2 btn-primary disabled:opacity-50">
              <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Sincronizando..." : "Sync Sheets"}
            </button>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView("list")}
              className={`px-3 py-2 text-xs font-medium transition-colors ${view === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              Lista
            </button>
            <button onClick={() => setView("kanban")}
              className={`px-3 py-2 text-xs font-medium transition-colors ${view === "kanban" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Filtro de drill-down activo (tipo/quien, desde el dashboard) */}
      {(tipoFilter || quienFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          {tipoFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">
              Tipo: {tipoFilter === "correctivo" ? "Correctivo" : "Preventivo"}
              <button onClick={() => { setTipoFilter(""); setPage(1); }} className="text-blue-400 hover:text-blue-700" title="Quitar filtro">×</button>
            </span>
          )}
          {quienFilter && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700">
              Ejecución: {quienFilter.charAt(0).toUpperCase() + quienFilter.slice(1)}
              <button onClick={() => { setQuienFilter(""); setPage(1); }} className="text-violet-400 hover:text-violet-700" title="Quitar filtro">×</button>
            </span>
          )}
        </div>
      )}

      {/* Filters (list only) */}
      {view === "list" && (
        <div className="flex gap-2 flex-wrap">
          {ESTADOS.map((e) => (
            <button key={e.value} onClick={() => { setEstadoFilter(e.value); setPage(1); }}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
              style={{
                color:       estadoFilter === e.value ? e.color   : "#64748B",
                background:  estadoFilter === e.value ? e.bg      : "#fff",
                borderColor: estadoFilter === e.value ? e.color   : "#E2E8F0",
              }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoFilter === e.value ? e.dot : "#CBD5E1" }} />
              {e.label}
            </button>
          ))}
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-xs text-gray-400 hidden sm:inline">Ordenar:</label>
            <select value={sortMode} onChange={(e) => { setSortMode(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-amber-400">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar equipo, sector, descripción..."
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
        </div>
      )}

      {prioritizing && (
        <p className="text-xs text-gray-400">
          {sortMode === "manual"
            ? "Arrastrá las OTs para fijar tu orden. Muestra las pendientes (no realizadas)."
            : `Ordenadas por «${SORT_OPTIONS.find(o => o.value === sortMode)?.label}». Muestra las pendientes (no realizadas).`}
        </p>
      )}

      {view === "kanban" ? (
        /* ── Kanban ── */
        kanbanLoading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {kanbanGroups.map((col) => (
              <div key={col.value}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{col.label}</span>
                  <span className="ml-auto text-xs font-mono text-gray-400">{col.count}</span>
                </div>
                <div className="space-y-2">
                  {col.count === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400">
                      Sin órdenes
                    </div>
                  )}
                  {col.items.map((o) => (
                    <KanbanCard key={o.id} order={o} canEdit={canEdit} onRegistrar={openRegistrar} />
                  ))}
                  {col.count > col.items.length && (
                    <div className="text-center text-xs text-gray-400 py-1">
                      +{col.count - col.items.length} más — usá la vista Lista para ver todas
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : (
        /* ── List ── */
        <>
          <p className="text-xs text-gray-400">{prioritizing ? `${listOrders.length} pendientes` : `${count} órdenes`}</p>
          {listOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
              <p className="text-gray-400 text-sm">
                {lastSync ? "No hay órdenes con esos filtros." : "Aún no se sincronizaron datos."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
              {listOrders.map((o, i) => {
                const meta   = estadoMeta(o.estado);
                const isOpen = expanded === o.id;
                const canDrag = sortMode === "manual" && canEdit;
                const prio = (o.prioridad ?? "").toString().toUpperCase();
                const prioColor = prio === "ALTA" ? "#DC2626" : prio === "BAJA" ? "#16A34A" : prio === "MEDIA" ? "#B45309" : null;
                return (
                  <div key={o.id}
                    draggable={canDrag}
                    onDragStart={canDrag ? () => setDragIdx(i) : undefined}
                    onDragOver={canDrag ? (e) => e.preventDefault() : undefined}
                    onDrop={canDrag ? () => onDrop(i) : undefined}
                    className={dragIdx === i ? "opacity-50" : ""}>
                    <button onClick={() => setExpanded(isOpen ? null : o.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
                      {canDrag && (
                        <span className="shrink-0 text-gray-300 cursor-grab active:cursor-grabbing" title="Arrastrar">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zM7 10a1 1 0 11-2 0 1 1 0 012 0zM6 17a1 1 0 100-2 1 1 0 000 2zM15 4a1 1 0 11-2 0 1 1 0 012 0zM14 11a1 1 0 100-2 1 1 0 000 2zM15 16a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                        </span>
                      )}
                      {prioritizing && <span className="text-xs font-mono text-gray-300 w-5 shrink-0 text-right">{i + 1}</span>}
                      <span className="text-xs font-mono font-bold text-gray-400 w-12 shrink-0">#{o.ot_number}</span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{o.descripcion ?? "—"}</p>
                        <p className="text-xs text-gray-400 truncate">{o.sector_raw}{o.equipo_raw ? ` · ${o.equipo_raw}` : ""}</p>
                      </div>
                      {prioColor && (
                        <span className="shrink-0 text-xs font-semibold hidden sm:inline" style={{ color: prioColor }} title="Prioridad">
                          {prio.charAt(0) + prio.slice(1).toLowerCase()}
                        </span>
                      )}
                      <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1"
                        style={{ color: meta.color, background: meta.bg, borderColor: meta.color + "33" }}>
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0 hidden md:block">
                        {o.fecha ? new Date(o.fecha).toLocaleDateString("es-AR") : "—"}
                      </span>
                      <svg className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isOpen && <OTDetail order={o} canEdit={canEdit} onRegistrar={openRegistrar} />}
                  </div>
                );
              })}
            </div>
          )}
          {!prioritizing && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">← Anterior</button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">Siguiente →</button>
            </div>
          )}
        </>
      )}

      {showNew && (
        <NuevaOTModal
          sectors={sectors}
          equipment={equipment}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load(); }}
        />
      )}

      {regModal && (
        <RegistrarOTModal
          order={regModal.order}
          estado={regModal.estado}
          onClose={() => setRegModal(null)}
          onDone={onRegistroDone}
        />
      )}
    </div>
  );
}

// ── Expanded detail row ───────────────────────────────────────────────────────
function OTDetail({ order: o, canEdit, onRegistrar }: {
  order: any; canEdit: boolean; onRegistrar: (order: any, estado: string) => void;
}) {
  const ESTADO_OPTIONS = ["POR_HACER", "EN_PROCESO", "REALIZADO", "ATRASADO"];
  const [showParts, setShowParts] = useState(false);
  return (
    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
        <D label="Especialidad"    value={o.especialidad} />
        <D label="Tipo"            value={o.tipo} />
        <D label="Quién realiza"   value={o.quien} />
        <D label="Contratista"     value={o.contratista} />
        <D label="Horas"           value={o.horas != null ? `${o.horas}h` : null} />
        <D label="Prioridad"       value={o.prioridad} />
        <D label="Operarios"       value={[o.operario_1, o.operario_2, o.operario_3].filter(Boolean).join(", ") || null} />
        <D label="Repuesto"        value={o.repuesto} />
        <D label="Fecha ejecución" value={o.fecha_ejecucion ? new Date(o.fecha_ejecucion).toLocaleDateString("es-AR") : null} />
        <D label="Fecha cierre"    value={o.fecha_cierre   ? new Date(o.fecha_cierre).toLocaleDateString("es-AR")   : null} />
        {o.app_created && <D label="Origen" value="Creada desde la app" />}
      </div>
      {o.descripcion && (
        <div>
          <p className="text-xs text-gray-500 font-medium mb-0.5">Descripción</p>
          <p className="text-sm text-gray-800">{o.descripcion}</p>
        </div>
      )}

      <div>
        <button onClick={() => setShowParts(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          Repuestos necesarios
        </button>
      </div>
      {showParts && <RepuestosOTModal order={o} onClose={() => setShowParts(false)} />}

      {canEdit && (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Cambiar estado:</span>
          {ESTADO_OPTIONS.map((e) => {
            const m = estadoMeta(e);
            return (
              <button key={e} onClick={() => onRegistrar(o, e)}
                disabled={o.estado === e}
                className="text-xs font-semibold px-2.5 py-1 rounded-full border transition-all disabled:opacity-40"
                style={{ color: m.color, background: m.bg, borderColor: m.color + "44" }}>
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Kanban card ───────────────────────────────────────────────────────────────
function KanbanCard({ order: o, canEdit, onRegistrar }: {
  order: any; canEdit: boolean; onRegistrar: (order: any, estado: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const NEXT: Record<string, string[]> = {
    POR_HACER:  ["EN_PROCESO", "ATRASADO"],
    EN_PROCESO: ["REALIZADO", "ATRASADO"],
    ATRASADO:   ["EN_PROCESO", "REALIZADO"],
    REALIZADO:  ["EN_PROCESO"],
  };
  const nextOptions = NEXT[o.estado] ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-2 relative">
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-mono text-gray-400">#{o.ot_number}</span>
        {canEdit && nextOptions.length > 0 && (
          <div className="relative">
            <button onClick={() => setMenu(m => !m)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>
            {menu && (
              <div className="absolute right-0 top-6 z-10 bg-white rounded-xl border border-gray-200 shadow-lg py-1 min-w-[130px]">
                {nextOptions.map(e => {
                  const m = estadoMeta(e);
                  return (
                    <button key={e} onClick={() => { onRegistrar(o, e); setMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 flex items-center gap-2"
                      style={{ color: m.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-3">{o.descripcion ?? "—"}</p>
      <p className="text-xs text-gray-400 truncate">{o.equipo_raw ?? o.sector_raw ?? "—"}</p>
      {o.fecha && <p className="text-xs text-gray-300">{new Date(o.fecha).toLocaleDateString("es-AR")}</p>}
    </div>
  );
}

function D({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}
