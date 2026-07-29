"use client";

import { useEffect, useState, useCallback } from "react";
import { useConfirm } from "@/app/components/ConfirmProvider";
import InfoTip from "@/app/components/InfoTip";

// Urgencias (los valores del Sheet incluyen emojis; se matchea por texto)
const URGENCIAS = [
  { key: "",      label: "Todas",  color: "#64748B", bg: "#F8FAFC" },
  { key: "Alta",  label: "Alta",   color: "#DC2626", bg: "#FEF2F2" },
  { key: "Media", label: "Media",  color: "#B45309", bg: "#FFFBEB" },
  { key: "Baja",  label: "Baja",   color: "#16A34A", bg: "#F0FDF4" },
];

function urgenciaMeta(raw: string) {
  const v = (raw ?? "").toLowerCase();
  if (v.includes("alta"))  return { label: "Alta",  color: "#DC2626", bg: "#FEF2F2" };
  if (v.includes("media")) return { label: "Media", color: "#B45309", bg: "#FFFBEB" };
  if (v.includes("baja"))  return { label: "Baja",  color: "#16A34A", bg: "#F0FDF4" };
  return { label: raw || "—", color: "#64748B", bg: "#F1F5F9" };
}

const EMPTY = {
  equipment_id: "", descripcion: "", urgencia: "🟡 Media", quien_aviso: "", observaciones: "",
};

export default function AvisosClient({ equipment, canEdit, canSync }: {
  equipment: any[]; canEdit: boolean; canSync: boolean;
}) {
  const confirm = useConfirm();
  const [avisos, setAvisos]     = useState<any[]>([]);
  const [count, setCount]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [urgFilter, setUrgFilter] = useState("");
  const [search, setSearch]     = useState("");
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [form, setForm]         = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (urgFilter) params.set("urgencia", urgFilter);
    if (search)    params.set("q", search);
    const res = await fetch(`/api/avisos?${params}`);
    const json = await res.json();
    setAvisos(json.data ?? []);
    setCount(json.count ?? 0);
    setLoading(false);
  }, [urgFilter, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/avisos/sync").then(r => r.json()).then(d => setLastSync(d.last_sync)); }, []);

  async function sync() {
    const ok = await confirm({
      title: "Sincronizar avisos",
      message: "Se traerán los avisos desde la planilla de Google Sheets. ¿Sincronizar ahora?",
      confirmText: "Sincronizar",
    });
    if (!ok) return;
    setSyncing(true); setSyncMsg("");
    const res = await fetch("/api/avisos/sync", { method: "POST" });
    const data = await res.json();
    if (res.ok) { setSyncMsg(`✓ ${data.synced} avisos sincronizados`); setLastSync(new Date().toISOString()); load(); }
    else        { setSyncMsg(`Error: ${data.error}`); }
    setSyncing(false);
  }

  async function crearAviso(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descripcion.trim()) { setError("La descripción es obligatoria."); return; }
    setSaving(true); setError("");
    const eq = equipment.find((x) => x.id === form.equipment_id);
    const res = await fetch("/api/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_id: form.equipment_id || null,
        sector_id:    eq?.sector_id ?? null,
        sector_raw:   eq?.sectors?.name ?? null,
        equipo_raw:   eq ? `${eq.code} — ${eq.name}` : null,
        equipo_code:  eq?.code ?? null,
        descripcion:  form.descripcion,
        urgencia:     form.urgencia,
        quien_aviso:  form.quien_aviso,
        observaciones: form.observaciones,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Error al crear el aviso."); return; }
    setShowNew(false); setForm({ ...EMPTY }); load();
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Avisos
            <InfoTip text="Un aviso reporta que algo necesita mantenimiento (qué equipo, sector, urgencia y quién avisó). Se sincronizan con la planilla de Avisos de Google Sheets. Desde un aviso se genera después la orden de trabajo (OT)." />
          </h1>
          {lastSync && (
            <p className="text-xs text-gray-400 mt-0.5">
              Última sync: {new Date(lastSync).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && (
            <span className={`text-sm ${syncMsg.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>{syncMsg}</span>
          )}
          {canEdit && (
            <button onClick={() => { setForm({ ...EMPTY }); setError(""); setShowNew(true); }}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors">
              + Nuevo aviso
            </button>
          )}
          {canSync && (
            <button onClick={sync} disabled={syncing} className="flex items-center gap-2 btn-primary disabled:opacity-50">
              <svg className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Sincronizando..." : "Sync Avisos"}
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {URGENCIAS.map((u) => (
          <button key={u.key} onClick={() => setUrgFilter(u.key)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
            style={{
              color:       urgFilter === u.key ? u.color : "#64748B",
              background:  urgFilter === u.key ? u.bg    : "#fff",
              borderColor: urgFilter === u.key ? u.color : "#E2E8F0",
            }}>
            {u.label}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar N° OA, equipo, sector, descripción..."
          className="w-full sm:w-64 sm:ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100" />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : avisos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <p className="text-gray-400 text-sm">{lastSync ? "No hay avisos con esos filtros." : "Aún no se sincronizaron avisos."}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">{count} avisos</p>
          <div className="space-y-2">
            {avisos.map((a) => {
              const m = urgenciaMeta(a.urgencia);
              return (
                <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">{a.oa_number}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                        {a.ot_asignada && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-green-700 bg-green-50 border border-green-200">
                            OT: {a.ot_asignada}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {a.fecha ? new Date(a.fecha + "T12:00:00").toLocaleDateString("es-AR") : ""}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1">{a.descripcion ?? "—"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[a.sector_raw, a.equipo_raw].filter(Boolean).join(" · ")}
                        {a.quien_aviso ? ` · avisó ${a.quien_aviso}` : ""}
                      </p>
                      {a.observaciones && <p className="text-xs text-gray-400 mt-1 italic">{a.observaciones}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Nuevo aviso */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <form onSubmit={crearAviso} className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">Nuevo aviso</h2>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Equipo</label>
              <select value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })} className="input">
                <option value="">Seleccioná un equipo...</option>
                {equipment.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.code} — {e.name} ({e.sectors?.name})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Urgencia</label>
              <select value={form.urgencia} onChange={(e) => setForm({ ...form, urgencia: e.target.value })} className="input">
                <option value="🔴 Alta">🔴 Alta</option>
                <option value="🟡 Media">🟡 Media</option>
                <option value="🟢 Baja">🟢 Baja</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Descripción <span className="text-red-500">*</span></label>
              <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={3} className="input resize-none" placeholder="Qué necesita mantenimiento..." />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Quién avisó</label>
              <input value={form.quien_aviso} onChange={(e) => setForm({ ...form, quien_aviso: e.target.value })} className="input" />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Observaciones</label>
              <textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                rows={2} className="input resize-none" />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Guardando..." : "Crear aviso"}
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
