"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConfirm } from "@/app/components/ConfirmProvider";
import InfoTip from "@/app/components/InfoTip";

export default function RepuestosEditor({ equipo, parts, canEdit }: {
  equipo: any; parts: any[]; canEdit: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: "", code: "", notes: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const base = `/api/equipos/${equipo.id}/repuestos`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");
    const res = editId
      ? await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ part_id: editId, ...form }) })
      : await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
    setForm({ name: "", code: "", notes: "" }); setEditId(null);
    router.refresh();
  }

  function startEdit(p: any) {
    setEditId(p.id);
    setForm({ name: p.name ?? "", code: p.code ?? "", notes: p.notes ?? "" });
    setError("");
  }

  async function remove(p: any) {
    const ok = await confirm({
      title: "Eliminar repuesto",
      message: `Se quitará "${p.name}" del catálogo de este equipo. No afecta OTs o avisos ya cargados.`,
      confirmText: "Eliminar", danger: true,
    });
    if (!ok) return;
    await fetch(`${base}?part_id=${p.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link href={`/equipos/${equipo.id}`} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver al equipo
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          Repuestos
          <InfoTip text="Catálogo de repuestos que puede consumir este equipo. Después, al crear una OT o un Aviso para este equipo, vas a poder elegir estos repuestos de una lista." />
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{equipo.code} — {equipo.name}</p>
      </div>

      {/* Alta / edición */}
      {canEdit && (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700" style={{ fontFamily: "'Syne', sans-serif" }}>
            {editId ? "Editar repuesto" : "Agregar repuesto"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block text-xs font-medium text-gray-600">Nombre <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input" placeholder="Ej: Rodamiento 6205" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Código</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="input" placeholder="Opcional" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Notas</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input" placeholder="Opcional" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? "Guardando..." : editId ? "Guardar cambios" : "Agregar"}
            </button>
            {editId && (
              <button type="button" onClick={() => { setEditId(null); setForm({ name: "", code: "", notes: "" }); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {parts.length === 0 ? (
          <p className="text-sm text-gray-400 py-10 text-center">Este equipo no tiene repuestos cargados.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {parts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">
                    {[p.code && `Cód: ${p.code}`, p.notes].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(p)} className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors">Editar</button>
                    <button onClick={() => remove(p)} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
