"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const ESPECIALIDADES = ["MECÁNICO", "ELÉCTRICO", "INSTRUMENTACIÓN", "CIVIL", "OTRO"];
const TIPOS = ["PROGRAMADO", "CORRECTIVO", "PREDICTIVO", "MEJORA"];
const QUIEN_OPTIONS = ["INTERNO", "CONTRATADO", "MIXTO"];
const PRIORIDADES = ["ALTA", "MEDIA", "BAJA"];
const FRECUENCIAS = [
  { value: "",           label: "Sin frecuencia" },
  { value: "DIARIO",     label: "Diario" },
  { value: "SEMANAL",    label: "Semanal" },
  { value: "QUINCENAL",  label: "Quincenal" },
  { value: "MENSUAL",    label: "Mensual" },
  { value: "TRIMESTRAL", label: "Trimestral" },
  { value: "SEMESTRAL",  label: "Semestral" },
  { value: "ANUAL",      label: "Anual" },
];
const ESTADOS_OT = [
  { value: "POR_HACER",  label: "Por hacer" },
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "REALIZADO",  label: "Realizado" },
  { value: "ATRASADO",   label: "Atrasado" },
];

export default function NuevaOTModal({ sectors, equipment, onClose, onCreated }: {
  sectors: any[];
  equipment: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [parts, setParts]   = useState<any[]>([]);

  const [form, setForm] = useState({
    equipment_id:   "",
    sector_id:      "",
    especialidad:   "",
    tipo:           "CORRECTIVO",
    quien:          "INTERNO",
    descripcion:    "",
    repuesto:       "",
    fecha:          new Date().toISOString().slice(0, 10),
    fecha_ejecucion: "",
    fecha_cierre:   "",
    frecuencia:     "",
    proxima_fecha:  "",
    estado:         "POR_HACER",
    contratista:    "",
    horas:          "",
    operario_1:     "",
    operario_2:     "",
    operario_3:     "",
    prioridad:      "MEDIA",
    requiere_parada_sector: false as boolean,
  });

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
    const folder = `work-orders/${Date.now()}`;
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

  function f(key: string, value: string) {
    setForm(p => {
      const next: any = { ...p, [key]: value };
      // Auto-fill sector from equipment
      if (key === "equipment_id" && value) {
        const eq = equipment.find((e: any) => e.id === value);
        if (eq) next.sector_id = eq.sector_id ?? "";
      }
      return next;
    });
  }

  // Cargar el catálogo de repuestos del equipo elegido
  useEffect(() => {
    if (!form.equipment_id) { setParts([]); return; }
    fetch(`/api/equipos/${form.equipment_id}/repuestos`)
      .then(r => r.json()).then(d => setParts(d.data ?? [])).catch(() => setParts([]));
  }, [form.equipment_id]);

  // Alternar un repuesto en el texto (separado por comas)
  function togglePart(name: string) {
    const current = form.repuesto.split(",").map(s => s.trim()).filter(Boolean);
    const idx = current.indexOf(name);
    if (idx >= 0) current.splice(idx, 1); else current.push(name);
    f("repuesto", current.join(", "));
  }
  const repuestoList = form.repuesto.split(",").map(s => s.trim()).filter(Boolean);

  const selectedEquip = equipment.find((e: any) => e.id === form.equipment_id);
  const filteredEquip = form.sector_id
    ? equipment.filter((e: any) => e.sector_id === form.sector_id)
    : equipment;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descripcion.trim()) { setError("La descripción es requerida."); return; }
    setSaving(true); setError("");

    const eq = equipment.find((eq: any) => eq.id === form.equipment_id);
    const sec = sectors.find((s: any) => s.id === form.sector_id);

    let reference_photos: string[] = [];
    try { reference_photos = await uploadPhotos(); } catch { /* fotos opcionales */ }

    const res = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        horas:         form.horas ? Number(form.horas) : null,
        proxima_fecha: form.proxima_fecha || null,
        frecuencia:    form.frecuencia || null,
        reference_photos,
        equipo_raw:  eq ? `${eq.code} – ${eq.name}` : null,
        equipo_code: eq?.code ?? null,
        sector_raw:  sec?.name ?? null,
        equipment_id: form.equipment_id || null,
        sector_id:   form.sector_id || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Error al crear"); setSaving(false); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl my-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Nueva Orden de Trabajo</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Equipo y sector */}
          <div className="grid grid-cols-2 gap-4">
            <F label="Sector">
              <select value={form.sector_id} onChange={e => f("sector_id", e.target.value)} className="input">
                <option value="">— Todos —</option>
                {sectors.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.plants?.name} · {s.name}</option>
                ))}
              </select>
            </F>
            <F label="Equipo">
              <select value={form.equipment_id} onChange={e => f("equipment_id", e.target.value)} className="input">
                <option value="">— Sin asignar —</option>
                {filteredEquip.map((eq: any) => (
                  <option key={eq.id} value={eq.id}>{eq.code} – {eq.name}</option>
                ))}
              </select>
            </F>
          </div>

          {/* Descripción */}
          <F label="Descripción del trabajo" required>
            <textarea value={form.descripcion} onChange={e => f("descripcion", e.target.value)}
              rows={3} className="input resize-none" placeholder="Describí el trabajo a realizar..." />
          </F>

          {/* ¿Requiere parar el sector? */}
          <label className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors"
            style={{ borderColor: form.requiere_parada_sector ? "#DC2626" : "#E2E8F0", background: form.requiere_parada_sector ? "#FEF2F2" : "#fff" }}>
            <input type="checkbox" checked={form.requiere_parada_sector}
              onChange={e => setForm(p => ({ ...p, requiere_parada_sector: e.target.checked }))}
              className="rounded" />
            <span className="text-sm font-medium" style={{ color: form.requiere_parada_sector ? "#DC2626" : "#374151" }}>
              ⛔ Requiere parar el sector para realizar el trabajo
            </span>
          </label>

          {/* Tipo / especialidad / quien */}
          <div className="grid grid-cols-3 gap-4">
            <F label="Especialidad">
              <select value={form.especialidad} onChange={e => f("especialidad", e.target.value)} className="input">
                <option value="">—</option>
                {ESPECIALIDADES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </F>
            <F label="Tipo">
              <select value={form.tipo} onChange={e => f("tipo", e.target.value)} className="input">
                {TIPOS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </F>
            <F label="Quién realiza">
              <select value={form.quien} onChange={e => f("quien", e.target.value)} className="input">
                {QUIEN_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </F>
          </div>

          {/* Repuesto */}
          <F label="Repuesto utilizado">
            {parts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
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
            <input value={form.repuesto} onChange={e => f("repuesto", e.target.value)}
              className="input" placeholder="Elegí de la lista o escribí libremente..." />
          </F>

          {/* Fechas */}
          <div className="grid grid-cols-3 gap-4">
            <F label="Fecha creación">
              <input type="date" value={form.fecha} onChange={e => f("fecha", e.target.value)} className="input" />
            </F>
            <F label="Fecha ejecución">
              <input type="date" value={form.fecha_ejecucion} onChange={e => f("fecha_ejecucion", e.target.value)} className="input" />
            </F>
            <F label="Fecha cierre">
              <input type="date" value={form.fecha_cierre} onChange={e => f("fecha_cierre", e.target.value)} className="input" />
            </F>
          </div>

          {/* Frecuencia / próxima fecha */}
          <div className="grid grid-cols-2 gap-4">
            <F label="Frecuencia">
              <select value={form.frecuencia} onChange={e => f("frecuencia", e.target.value)} className="input">
                {FRECUENCIAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </F>
            <F label="Próxima fecha">
              <input type="date" value={form.proxima_fecha} onChange={e => f("proxima_fecha", e.target.value)} className="input" />
            </F>
          </div>

          {/* Fotos de referencia */}
          <F label="Fotos de referencia (hasta 3)">
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-3 hover:border-amber-400 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-500">
                {photos.length === 0 ? "Adjuntar foto..." : `${photos.length} foto(s) seleccionada(s)`}
              </span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => handlePhotos(e.target.files)} />
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
          </F>

          {/* Estado / prioridad / horas */}
          <div className="grid grid-cols-3 gap-4">
            <F label="Estado inicial">
              <select value={form.estado} onChange={e => f("estado", e.target.value)} className="input">
                {ESTADOS_OT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </F>
            <F label="Prioridad">
              <select value={form.prioridad} onChange={e => f("prioridad", e.target.value)} className="input">
                {PRIORIDADES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </F>
            <F label="Horas estimadas">
              <input type="number" value={form.horas} onChange={e => f("horas", e.target.value)}
                className="input" placeholder="—" min={0} step={0.5} />
            </F>
          </div>

          {/* Contratista y operarios */}
          {(form.quien === "CONTRATADO" || form.quien === "MIXTO") && (
            <F label="Contratista">
              <input value={form.contratista} onChange={e => f("contratista", e.target.value)} className="input" />
            </F>
          )}
          <div className="grid grid-cols-3 gap-4">
            <F label="Operario 1">
              <input value={form.operario_1} onChange={e => f("operario_1", e.target.value)} className="input" placeholder="—" />
            </F>
            <F label="Operario 2">
              <input value={form.operario_2} onChange={e => f("operario_2", e.target.value)} className="input" placeholder="—" />
            </F>
            <F label="Operario 3">
              <input value={form.operario_3} onChange={e => f("operario_3", e.target.value)} className="input" placeholder="—" />
            </F>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <button type="submit" disabled={saving}
              className="btn-primary disabled:opacity-50">
              {saving ? "Guardando..." : "Crear OT"}
            </button>
            <button type="button" onClick={onClose}
              className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <p className="ml-auto text-xs text-gray-400 self-center">
              Se registrará en Sheets automáticamente al guardar
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
