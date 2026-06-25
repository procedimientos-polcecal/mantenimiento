"use client";

import { useEffect, useState, useCallback } from "react";

const ESTADOS = [
  { value: "",           label: "Todos",      color: "#64748B", bg: "#F8FAFC", dot: "#94A3B8" },
  { value: "ATRASADO",   label: "Atrasado",   color: "#DC2626", bg: "#FEF2F2", dot: "#EF4444" },
  { value: "EN_PROCESO", label: "En proceso", color: "#1D4ED8", bg: "#EFF6FF", dot: "#3B82F6" },
  { value: "POR_HACER",  label: "Por hacer",  color: "#B45309", bg: "#FFFBEB", dot: "#F59E0B" },
  { value: "REALIZADO",  label: "Realizado",  color: "#16A34A", bg: "#F0FDF4", dot: "#22C55E" },
];

function estadoMeta(v: string) {
  return ESTADOS.find((e) => e.value === v) ?? ESTADOS[0];
}

export default function OrdenesClient({ canSync }: { canSync: boolean }) {
  const [orders, setOrders]       = useState<any[]>([]);
  const [count, setCount]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [lastSync, setLastSync]   = useState<string | null>(null);
  const [syncMsg, setSyncMsg]     = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (estadoFilter) params.set("estado", estadoFilter);
    if (search)       params.set("q", search);
    const res = await fetch(`/api/work-orders?${params}`);
    const json = await res.json();
    setOrders(json.data ?? []);
    setCount(json.count ?? 0);
    setLoading(false);
  }, [page, estadoFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/work-orders/sync").then(r => r.json()).then(d => setLastSync(d.last_sync));
  }, []);

  async function sync() {
    setSyncing(true);
    setSyncMsg("");
    const res = await fetch("/api/work-orders/sync", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setSyncMsg(`✓ ${data.synced} órdenes sincronizadas`);
      setLastSync(new Date().toISOString());
      load();
    } else {
      setSyncMsg(`Error: ${data.error}`);
    }
    setSyncing(false);
  }

  const totalPages = Math.ceil(count / 50);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Órdenes de Trabajo</h1>
          {lastSync && (
            <p className="text-xs text-gray-400 mt-0.5">
              Última sync: {new Date(lastSync).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </div>
        {canSync && (
          <div className="flex items-center gap-3">
            {syncMsg && (
              <span className={`text-sm ${syncMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
                {syncMsg}
              </span>
            )}
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Sincronizando..." : "Sincronizar Sheets"}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            onClick={() => { setEstadoFilter(e.value); setPage(1); }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
            style={{
              color:       estadoFilter === e.value ? e.color : "#64748B",
              background:  estadoFilter === e.value ? e.bg    : "#fff",
              borderColor: estadoFilter === e.value ? e.color : "#E2E8F0",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoFilter === e.value ? e.dot : "#CBD5E1" }} />
            {e.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar equipo, sector, descripción..."
          className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 w-60"
        />
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400">{count} órdenes</p>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">
            {lastSync ? "No hay órdenes con esos filtros." : "Aún no se sincronizaron datos. Hacé click en «Sincronizar Sheets»."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {orders.map((o) => {
            const meta = estadoMeta(o.estado);
            const isOpen = expanded === o.id;
            return (
              <div key={o.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                >
                  {/* OT number */}
                  <span className="text-xs font-mono font-bold text-gray-400 w-12 shrink-0">
                    #{o.ot_number}
                  </span>

                  {/* Estado dot */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{o.descripcion ?? "—"}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {o.sector_raw} {o.equipo_raw ? `· ${o.equipo_raw}` : ""}
                    </p>
                  </div>

                  {/* Estado badge */}
                  <span
                    className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1"
                    style={{ color: meta.color, background: meta.bg, borderColor: meta.color + "33" }}
                  >
                    {meta.label}
                  </span>

                  {/* Date */}
                  <span className="text-xs text-gray-400 shrink-0 hidden md:block">
                    {o.fecha ? new Date(o.fecha).toLocaleDateString("es-AR") : "—"}
                  </span>

                  <svg
                    className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-100 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                    <Detail label="Especialidad"     value={o.especialidad} />
                    <Detail label="Tipo"             value={o.tipo} />
                    <Detail label="Quién realiza"    value={o.quien} />
                    <Detail label="Contratista"      value={o.contratista} />
                    <Detail label="Horas"            value={o.horas != null ? `${o.horas}h` : null} />
                    <Detail label="Prioridad"        value={o.prioridad} />
                    <Detail label="Operarios"        value={[o.operario_1, o.operario_2, o.operario_3].filter(Boolean).join(", ") || null} />
                    <Detail label="Repuesto"         value={o.repuesto} />
                    <Detail label="Fecha ejecución"  value={o.fecha_ejecucion ? new Date(o.fecha_ejecucion).toLocaleDateString("es-AR") : null} />
                    <Detail label="Fecha cierre"     value={o.fecha_cierre   ? new Date(o.fecha_cierre).toLocaleDateString("es-AR")   : null} />
                    {o.descripcion && (
                      <div className="col-span-2 md:col-span-3 mt-1">
                        <p className="text-xs text-gray-500 font-medium mb-0.5">Descripción</p>
                        <p className="text-sm text-gray-800">{o.descripcion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}
