"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PlanificacionClient({ plans, canEdit }: { plans: any[]; canEdit: boolean }) {
  const router = useRouter();
  const [showNew, setShowNew]   = useState(false);
  const [fecha, setFecha]       = useState(new Date().toISOString().slice(0, 10));
  const [titulo, setTitulo]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/planificacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, titulo }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Error"); setSaving(false); return; }
    router.push(`/planificacion/${data.data.id}`);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Planificación diaria</h1>
          <p className="text-sm text-gray-400 mt-0.5">Programá el trabajo del día y generá las órdenes para imprimir</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo plan
          </button>
        )}
      </div>

      {/* Plan list */}
      {plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-400 text-sm">Todavía no hay planes. Creá el primero.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {plans.map((p) => {
            const fecha = new Date(p.fecha + "T12:00:00");
            const itemCount = p.daily_plan_items?.length ?? 0;
            const isToday = p.fecha === new Date().toISOString().slice(0, 10);
            return (
              <Link key={p.id} href={`/planificacion/${p.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                {/* Date box */}
                <div className={`shrink-0 w-14 rounded-xl text-center py-1.5 ${isToday ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>
                  <div className="text-lg font-bold leading-none">{fecha.getDate()}</div>
                  <div className="text-xs mt-0.5 capitalize">
                    {fecha.toLocaleDateString("es-AR", { month: "short" })}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {p.titulo || fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                    {isToday && <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Hoy</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {itemCount} {itemCount === 1 ? "orden" : "órdenes"}
                    {p.created_by_user?.full_name ? ` · ${p.created_by_user.full_name}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400">{itemCount > 0 ? `${itemCount} OT` : "—"}</span>
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* New plan modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-gray-900">Nuevo plan de trabajo</h2>
            <form onSubmit={create} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Fecha <span className="text-red-500">*</span></label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="input w-full" required />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Título (opcional)</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Ej: Mantenimiento semanal calcinación"
                  className="input w-full" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? "Creando..." : "Crear plan"}
                </button>
                <button type="button" onClick={() => setShowNew(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
