"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { estadoMeta } from "./OrdenesClient";

export default function RegistrarOTModal({ order, estado, onClose, onDone }: {
  order: any; estado: string; onClose: () => void; onDone: () => void;
}) {
  const meta = estadoMeta(estado);
  const [execStatus, setExecStatus] = useState(estado === "REALIZADO" ? "completado" : "parcial");
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(order.horas != null ? String(order.horas) : "");
  const [obs, setObs] = useState("");
  const [op1, setOp1] = useState(order.operario_1 ?? "");
  const [op2, setOp2] = useState(order.operario_2 ?? "");
  const [op3, setOp3] = useState(order.operario_3 ?? "");
  const [contratista, setContratista] = useState(order.contratista ?? "");
  const [contratistas, setContratistas] = useState<any[]>([]);
  const [operarios, setOperarios] = useState<any[]>([]);

  const [checklist, setChecklist] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!order.equipment_id) return;
    const supabase = createClient();
    supabase.from("equipment_checklists").select("*").eq("equipment_id", order.equipment_id)
      .eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setChecklist(data ?? null));
  }, [order.equipment_id]);

  useEffect(() => {
    fetch("/api/contratistas").then((r) => r.json()).then((d) => setContratistas(d.data ?? [])).catch(() => {});
    fetch("/api/operarios").then((r) => r.json()).then((d) => setOperarios(d.data ?? [])).catch(() => {});
  }, []);

  function handlePhotos(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5);
    setPhotos((p) => [...p, ...arr].slice(0, 5));
    arr.forEach((f) => { const rd = new FileReader(); rd.onload = (e) => setPreviews((p) => [...p, e.target?.result as string]); rd.readAsDataURL(f); });
  }
  function removePhoto(i: number) { setPhotos((p) => p.filter((_, x) => x !== i)); setPreviews((p) => p.filter((_, x) => x !== i)); }

  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return [];
    const supabase = createClient();
    const urls: string[] = [];
    for (const photo of photos) {
      const ext = photo.name.split(".").pop() ?? "jpg";
      const path = `work-orders/${order.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("execution-photos").upload(path, photo, { upsert: false });
      if (!error) urls.push(supabase.storage.from("execution-photos").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  }

  async function save() {
    if (checklist?.items) {
      const missing = checklist.items.filter((it: any) => it.required && (responses[it.id] === undefined || responses[it.id] === ""));
      if (missing.length > 0) { setError(`Completá los ítems obligatorios: ${missing.map((i: any) => i.label).join(", ")}`); return; }
    }
    setSaving(true); setError("");
    const photo_urls = await uploadPhotos();

    // 1) Registrar la ejecución
    await fetch("/api/ejecuciones", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        work_order_id: order.id, execution_status: execStatus, executed_at: executedAt,
        duration_hours: duration ? Number(duration) : null, observations: obs.trim() || null,
        checklist_snapshot: checklist ?? null, checklist_responses: checklist ? responses : null,
        photo_urls, equipment_code: order.equipo_code, equipment_name: order.equipo_raw, ot_number: order.ot_number,
      }),
    });

    // 2) Actualizar la OT: estado + operarios + horas (y escribir en Sheets)
    const res = await fetch("/api/work-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: order.id, estado,
        operario_1: op1, operario_2: op2, operario_3: op3, contratista,
        horas: duration ? Number(duration) : null,
        fecha_cierre: executedAt,                       // fecha (solo) → columna K
        observaciones: obs.trim() || null,              // → columna W
        foto_url: photo_urls[0] ?? null,                // primera foto → columna V
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error al guardar"); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-base font-bold text-gray-900">Registrar — {meta.label}</h2>
          <p className="text-xs text-gray-400 mt-0.5">OT #{order.ot_number} · {order.equipo_raw ?? order.descripcion ?? ""}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Resultado">
            <select value={execStatus} onChange={(e) => setExecStatus(e.target.value)} className="input">
              <option value="completado">Completado</option>
              <option value="parcial">Parcial</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </Field>
          <Field label="Duración (horas)">
            <input type="number" min="0" step="0.5" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="—" className="input" />
          </Field>
        </div>

        <Field label="Fecha">
          <input type="date" value={executedAt} onChange={(e) => setExecutedAt(e.target.value)} className="input" />
        </Field>

        <div className="rounded-lg px-3 py-2 text-xs" style={{ background: meta.bg, color: meta.color }}>
          La OT pasará al estado <b>{meta.label}</b>.
        </div>

        {/* Operarios */}
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Operarios que la realizaron</p>
          <div className="grid grid-cols-3 gap-2">
            <OperarioSelect slot={1} value={op1} onChange={setOp1} operarios={operarios} />
            <OperarioSelect slot={2} value={op2} onChange={setOp2} operarios={operarios} />
            <OperarioSelect slot={3} value={op3} onChange={setOp3} operarios={operarios} />
          </div>
        </div>

        <Field label="Contratista">
          <select value={contratista} onChange={(e) => setContratista(e.target.value)} className="input">
            <option value="">—</option>
            {contratistas.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            {contratista && !contratistas.some((c) => c.nombre === contratista) && <option value={contratista}>{contratista}</option>}
          </select>
        </Field>

        {/* Checklist */}
        {checklist?.items?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{checklist.name}</p>
            {checklist.items.map((it: any) => (
              <div key={it.id} className="rounded-lg border border-gray-200 p-3 space-y-1">
                <p className="text-sm text-gray-800">{it.label}{it.required && <span className="text-red-500 ml-1">*</span>}</p>
                {it.type === "check" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!responses[it.id]} onChange={(e) => setResponses((r) => ({ ...r, [it.id]: e.target.checked }))} className="rounded" />
                    <span className="text-xs text-gray-500">Verificado</span>
                  </label>
                )}
                {it.type === "number" && (
                  <input type="number" value={responses[it.id] ?? ""} onChange={(e) => setResponses((r) => ({ ...r, [it.id]: e.target.value }))} className="input w-32" placeholder="0" />
                )}
                {it.type === "text" && (
                  <textarea rows={2} value={responses[it.id] ?? ""} onChange={(e) => setResponses((r) => ({ ...r, [it.id]: e.target.value }))} className="input resize-none" />
                )}
              </div>
            ))}
          </div>
        )}

        <Field label="Observaciones">
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className="input resize-none" placeholder="Detalle de lo realizado..." />
        </Field>

        {/* Fotos */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Fotos (máx. 5)</p>
          {previews.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  <button onClick={() => removePhoto(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none">✕</button>
                </div>
              ))}
            </div>
          )}
          {photos.length < 5 && (
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors w-fit">
              <span>📷 Agregar foto</span>
              <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
            </label>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="block text-xs font-medium text-gray-600">{label}</label>{children}</div>;
}

function OperarioSelect({ slot, value, onChange, operarios }: {
  slot: number; value: string; onChange: (v: string) => void; operarios: any[];
}) {
  const opciones = operarios.filter((o) => o.slot === slot);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input" aria-label={`Operario ${slot}`}>
      <option value="">Operario {slot}</option>
      {opciones.map((o) => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
      {value && !opciones.some((o) => o.nombre === value) && <option value={value}>{value}</option>}
    </select>
  );
}
