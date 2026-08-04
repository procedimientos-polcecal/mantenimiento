"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConfirm } from "@/app/components/ConfirmProvider";
import InfoTip from "@/app/components/InfoTip";

const EMPTY = { nombre: "", categoria: "", especificacion: "", material: "", cantidad: "", proveedor_critico: "", criticidad: "" };

export default function ComponentesEditor({ equipo, components, canEdit }: {
  equipo: any; components: any[]; canEdit: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [form, setForm] = useState({ ...EMPTY });
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const base = `/api/equipos/${equipo.id}/componentes`;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    const res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
    setForm({ ...EMPTY }); setShowNew(false);
    router.refresh();
  }

  async function remove(c: any) {
    const ok = await confirm({ title: "Eliminar componente", message: `Se quitará "${c.nombre}" del equipo.`, confirmText: "Eliminar", danger: true });
    if (!ok) return;
    await fetch(`${base}?comp_id=${c.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <Link href={`/equipos/${equipo.id}`} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al equipo
        </Link>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Componentes
              <InfoTip text="Partes que componen este equipo (mandíbulas, cadenas, mallas, rodamientos, etc.), con su especificación, material, cantidad y criticidad. Se importan desde la BD de equipos y se pueden agregar a mano." />
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{equipo.code} — {equipo.name}</p>
          </div>
          {canEdit && (
            <button onClick={() => { setShowNew(true); setError(""); }} className="btn-primary">+ Agregar</button>
          )}
        </div>
      </div>

      {components.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          Este equipo no tiene componentes cargados.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {components.map((c) => (
            <div key={c.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900">{c.nombre}</span>
                  {c.categoria && <span className="text-xs text-gray-400">{c.categoria}</span>}
                  {c.criticidad && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ color: /alta|crit/i.test(c.criticidad) ? "#DC2626" : "#64748B", background: /alta|crit/i.test(c.criticidad) ? "#FEF2F2" : "#F1F5F9" }}>
                      {c.criticidad}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[c.especificacion, c.material, c.cantidad && `Cant: ${c.cantidad}`, c.proveedor_critico && `Prov: ${c.proveedor_critico}`].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {canEdit && (
                <button onClick={() => remove(c)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 shrink-0">Eliminar</button>
              )}
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <form onSubmit={add} className="w-full max-w-md rounded-2xl bg-white p-6 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">Nuevo componente</h2>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Nombre <span className="text-red-500">*</span></label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Categoría</label>
                <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="input" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Criticidad</label>
                <input value={form.criticidad} onChange={(e) => setForm({ ...form, criticidad: e.target.value })} className="input" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Especificación</label>
              <input value={form.especificacion} onChange={(e) => setForm({ ...form, especificacion: e.target.value })} className="input" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Material</label>
                <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} className="input" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Cantidad</label>
                <input value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} className="input" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Proveedor</label>
                <input value={form.proveedor_critico} onChange={(e) => setForm({ ...form, proveedor_critico: e.target.value })} className="input" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Guardando..." : "Agregar"}</button>
              <button type="button" onClick={() => setShowNew(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
