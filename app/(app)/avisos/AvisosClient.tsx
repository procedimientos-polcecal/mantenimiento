"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
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
  equipment_id: "", descripcion: "", urgencia: "🟡 Media", quien_aviso: "", observaciones: "", repuesto: "",
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
  const [page, setPage]         = useState(1);
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState("");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [showNew, setShowNew]   = useState(false);
  const [form, setForm]         = useState({ ...EMPTY });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [photos, setPhotos]     = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [parts, setParts]       = useState<any[]>([]);
  const [otBusy, setOtBusy]     = useState<string | null>(null);
  const [otMsg, setOtMsg]       = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (urgFilter) params.set("urgencia", urgFilter);
    if (search)    params.set("q", search);
    params.set("page", String(page));
    const res = await fetch(`/api/avisos?${params}`);
    const json = await res.json();
    setAvisos(json.data ?? []);
    setCount(json.count ?? 0);
    setLoading(false);
  }, [urgFilter, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/avisos/sync").then(r => r.json()).then(d => setLastSync(d.last_sync)); }, []);

  // Catálogo de repuestos del equipo elegido en el form
  useEffect(() => {
    if (!form.equipment_id) { setParts([]); return; }
    fetch(`/api/equipos/${form.equipment_id}/repuestos`)
      .then(r => r.json()).then(d => setParts(d.data ?? [])).catch(() => setParts([]));
  }, [form.equipment_id]);

  function togglePart(name: string) {
    const current = form.repuesto.split(",").map(s => s.trim()).filter(Boolean);
    const idx = current.indexOf(name);
    if (idx >= 0) current.splice(idx, 1); else current.push(name);
    setForm({ ...form, repuesto: current.join(", ") });
  }
  const repuestoList = form.repuesto.split(",").map(s => s.trim()).filter(Boolean);

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

  // Generar una OT a partir de un aviso (y vincularla)
  async function generarOT(a: any) {
    const ok = await confirm({
      title: "Generar OT desde el aviso",
      message: `Se creará una orden de trabajo a partir del aviso ${a.oa_number} (${a.equipo_raw ?? "sin equipo"}), se agregará a la planilla de OTs y el aviso quedará marcado como "OT asignada". ¿Continuar?`,
      confirmText: "Generar OT",
    });
    if (!ok) return;
    setOtBusy(a.id); setOtMsg(null);
    const res = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_id: a.equipment_id ?? null,
        sector_id:    a.sector_id ?? null,
        sector_raw:   a.sector_raw ?? null,
        equipo_raw:   a.equipo_raw ?? null,
        equipo_code:  a.equipo_code ?? null,
        descripcion:  a.descripcion ?? `Aviso ${a.oa_number}`,
        repuesto:     a.repuesto ?? null,
        tipo:         "CORRECTIVO",
        estado:       "POR_HACER",
        prioridad:    /alta/i.test(a.urgencia ?? "") ? "ALTA" : /baja/i.test(a.urgencia ?? "") ? "BAJA" : "MEDIA",
        aviso_id:     a.id,
      }),
    });
    const data = await res.json();
    setOtBusy(null);
    if (!res.ok) { setOtMsg({ id: a.id, text: data.error ?? "Error al crear la OT", ok: false }); return; }
    setOtMsg({ id: a.id, text: `OT #${data.ot_number} creada`, ok: true });
    load();
  }

  function handlePhotos(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 3);
    setPhotos(p => [...p, ...arr].slice(0, 3));
    arr.forEach(fl => {
      const reader = new FileReader();
      reader.onload = ev => setPhotoPreviews(p => [...p, ev.target?.result as string]);
      reader.readAsDataURL(fl);
    });
  }
  function removePhoto(idx: number) {
    setPhotos(p => p.filter((_, i) => i !== idx));
    setPhotoPreviews(p => p.filter((_, i) => i !== idx));
  }
  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return [];
    const supabase = createClient();
    const urls: string[] = [];
    const folder = `avisos/${Date.now()}`;
    for (const photo of photos) {
      const ext = photo.name.split(".").pop() ?? "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("execution-photos").upload(path, photo, { upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("execution-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  async function crearAviso(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descripcion.trim()) { setError("La descripción es obligatoria."); return; }
    setSaving(true); setError("");
    const eq = equipment.find((x) => x.id === form.equipment_id);
    let reference_photos: string[] = [];
    try { reference_photos = await uploadPhotos(); } catch { /* fotos opcionales */ }
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
        repuesto:     form.repuesto,
        reference_photos,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Error al crear el aviso."); return; }
    setShowNew(false); setForm({ ...EMPTY }); setPhotos([]); setPhotoPreviews([]); load();
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
            <button onClick={() => { setForm({ ...EMPTY }); setError(""); setPhotos([]); setPhotoPreviews([]); setShowNew(true); }}
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
          <button key={u.key} onClick={() => { setUrgFilter(u.key); setPage(1); }}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
            style={{
              color:       urgFilter === u.key ? u.color : "#64748B",
              background:  urgFilter === u.key ? u.bg    : "#fff",
              borderColor: urgFilter === u.key ? u.color : "#E2E8F0",
            }}>
            {u.label}
          </button>
        ))}
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
          <p className="text-xs text-gray-400">
            {count} avisos
            {count > 50 && <> · mostrando {(page - 1) * 50 + 1}–{Math.min(page * 50, count)}</>}
          </p>
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
                      {a.repuesto && <p className="text-xs text-gray-500 mt-1">🔧 {a.repuesto}</p>}
                      {a.observaciones && <p className="text-xs text-gray-400 mt-1 italic">{a.observaciones}</p>}
                      {Array.isArray(a.reference_photos) && a.reference_photos.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {a.reference_photos.map((url: string, i: number) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {canEdit && (
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {otMsg && otMsg.id === a.id ? (
                          <span className={`text-xs ${otMsg.ok ? "text-green-600" : "text-red-600"}`}>{otMsg.text}</span>
                        ) : (a.work_order_id || a.ot_asignada) ? (
                          <span className="text-xs text-gray-400">OT ya asignada</span>
                        ) : (
                          <button onClick={() => generarOT(a)} disabled={otBusy === a.id}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40">
                            {otBusy === a.id ? "Creando..." : "Generar OT"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Repuestos</label>
              {parts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {parts.map((p: any) => {
                    const on = repuestoList.includes(p.name);
                    return (
                      <button key={p.id} type="button" onClick={() => togglePart(p.name)}
                        className="rounded-full px-2.5 py-1 text-xs font-medium border transition-colors"
                        style={{
                          color: on ? "#B45309" : "#64748B",
                          background: on ? "#FFFBEB" : "#fff",
                          borderColor: on ? "#F59E0B" : "#E2E8F0",
                        }}
                        title={p.code ? `Cód: ${p.code}` : undefined}>
                        {on ? "✓ " : ""}{p.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <input value={form.repuesto} onChange={(e) => setForm({ ...form, repuesto: e.target.value })}
                className="input" placeholder={parts.length ? "Elegí de la lista o escribí..." : "Elegí un equipo para ver sus repuestos, o escribí libremente"} />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Foto (hasta 3)</label>
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-3 hover:border-amber-400 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-gray-500">
                  {photos.length === 0 ? "Adjuntar foto..." : `${photos.length} foto(s) seleccionada(s)`}
                </span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
              </label>
              {photoPreviews.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
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
