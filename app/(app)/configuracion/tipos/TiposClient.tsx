"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConfirm } from "@/app/components/ConfirmProvider";
import InfoTip from "@/app/components/InfoTip";

// Campos editables (agrupados)
const GROUPS: { title: string; fields: { key: string; label: string; area?: boolean }[] }[] = [
  { title: "General", fields: [
    { key: "nombre_tipo", label: "Nombre del tipo" },
    { key: "categoria", label: "Categoría" },
    { key: "descripcion_funcion", label: "Función", area: true },
    { key: "accionamiento", label: "Accionamiento" },
  ]},
  { title: "Eléctrico / mecánico", fields: [
    { key: "potencia_kw_tipica", label: "Potencia típica (kW)" },
    { key: "tension_v", label: "Tensión (V)" },
    { key: "velocidad_rpm_tipica", label: "RPM típica" },
    { key: "tiene_reductor", label: "¿Tiene reductor?" },
    { key: "relacion_reduccion", label: "Relación de reducción" },
    { key: "tipo_correa", label: "Tipo de correa" },
    { key: "cant_correas", label: "Cant. correas" },
  ]},
  { title: "Rodamientos y lubricación", fields: [
    { key: "rodamiento_lado_motor", label: "Rodamiento lado motor" },
    { key: "rodamiento_lado_carga", label: "Rodamiento lado carga" },
    { key: "rodamiento_intermedio", label: "Rodamiento intermedio" },
    { key: "lubricante_tipo", label: "Lubricante" },
    { key: "lubricante_marca_ref", label: "Marca / ref. lubricante" },
    { key: "frecuencia_lubricacion", label: "Frec. lubricación" },
  ]},
  { title: "Frecuencias de mantenimiento", fields: [
    { key: "freq_inspeccion_visual", label: "Frec. inspección visual" },
    { key: "freq_lubricacion", label: "Frec. lubricación (PM)" },
    { key: "freq_revision_mayor", label: "Frec. revisión mayor" },
    { key: "notas_tecnicas", label: "Notas técnicas", area: true },
  ]},
];
const ALL_KEYS = GROUPS.flatMap((g) => g.fields.map((f) => f.key));
const EMPTY = () => Object.fromEntries(ALL_KEYS.map((k) => [k, ""])) as Record<string, string>;

export default function TiposClient({ tipos }: { tipos: any[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<any>(null); // tipo en edición o { _new: true }
  const [form, setForm] = useState<Record<string, string>>(EMPTY());
  const [tipoId, setTipoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openNew() {
    setEditing({ _new: true }); setTipoId(""); setForm(EMPTY()); setError("");
  }
  function openEdit(t: any) {
    setEditing(t); setTipoId(t.tipo_id);
    const f = EMPTY();
    for (const k of ALL_KEYS) f[k] = t[k] ?? "";
    setForm(f); setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (editing?._new && !tipoId.trim()) { setError("El código del tipo es obligatorio."); return; }
    if (!form.nombre_tipo.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    const isNew = !!editing?._new;
    const res = await fetch("/api/tipos", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo_id: tipoId.trim(), ...form }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
    setEditing(null);
    router.refresh();
  }

  async function remove(t: any) {
    const ok = await confirm({
      title: "Eliminar tipo",
      message: `Se eliminará el tipo "${t.nombre_tipo}". Los equipos que lo tengan asignado quedarán sin tipo.`,
      confirmText: "Eliminar", danger: true,
    });
    if (!ok) return;
    await fetch(`/api/tipos?tipo_id=${encodeURIComponent(t.tipo_id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <Link href="/configuracion" className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Configuración
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Tipos de equipo
            <InfoTip text="Catálogo de tipos de equipo con sus datos de referencia (lubricante, rodamientos, frecuencias). Cada equipo se asigna a un tipo, que aparece como guía en su detalle." />
          </h1>
          <button onClick={openNew} className="btn-primary">+ Nuevo tipo</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {tipos.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">Sin tipos cargados.</p>}
        {tipos.map((t) => (
          <div key={t.tipo_id} className="flex items-center gap-3 px-4 py-3">
            <span className="font-mono text-xs font-bold text-gray-400 w-12 shrink-0">{t.tipo_id}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t.nombre_tipo}</p>
              <p className="text-xs text-gray-400">{[t.categoria, t.lubricante_tipo].filter(Boolean).join(" · ")}</p>
            </div>
            <button onClick={() => openEdit(t)} className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">Editar</button>
            <button onClick={() => remove(t)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">Eliminar</button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-2xl rounded-2xl bg-white p-6 space-y-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">{editing._new ? "Nuevo tipo de equipo" : `Editar tipo ${editing.tipo_id}`}</h2>

            {editing._new && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Código (tipo_id) <span className="text-red-500">*</span></label>
                <input value={tipoId} onChange={(e) => setTipoId(e.target.value.toUpperCase())} className="input" placeholder="Ej: CT, RM, ZV..." />
              </div>
            )}

            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{g.title}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {g.fields.map((fl) => (
                    <div key={fl.key} className={`space-y-1 ${fl.area ? "sm:col-span-2" : ""}`}>
                      <label className="block text-xs font-medium text-gray-600">{fl.label}</label>
                      {fl.area ? (
                        <textarea value={form[fl.key]} onChange={(e) => setForm({ ...form, [fl.key]: e.target.value })} rows={2} className="input resize-none" />
                      ) : (
                        <input value={form[fl.key]} onChange={(e) => setForm({ ...form, [fl.key]: e.target.value })} className="input" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
