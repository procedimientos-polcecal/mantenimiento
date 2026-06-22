"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUS_COLORS: Record<string, string> = {
  completado:  "bg-green-100 text-green-800",
  parcial:     "bg-yellow-100 text-yellow-800",
  cancelado:   "bg-red-100 text-red-800",
};

const EMPTY_FORM = {
  schedule_id:    "",
  execution_status: "completado",
  executed_at:    new Date().toISOString().slice(0, 16),
  duration_hours: "",
  observations:   "",
  next_date_override: "",
};

export default function EjecucionesClient({ schedules, executions, currentUserId, canExecute }: {
  schedules: any[];
  executions: any[];
  currentUserId: string;
  canExecute: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pendientes" | "recientes">("pendientes");

  function field(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openFor(scheduleId: string) {
    setForm({ ...EMPTY_FORM, schedule_id: scheduleId });
    setShowForm(true);
    setError("");
  }

  async function save() {
    if (!form.schedule_id) { setError("Seleccioná un mantenimiento."); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();

    const schedule = schedules.find((s) => s.id === form.schedule_id);

    const { error: err } = await supabase.from("maintenance_executions").insert({
      schedule_id:      form.schedule_id,
      executed_by:      currentUserId,
      execution_status: form.execution_status,
      executed_at:      form.executed_at,
      duration_hours:   form.duration_hours ? Number(form.duration_hours) : null,
      observations:     form.observations.trim() || null,
    });

    if (err) { setError(err.message); setSaving(false); return; }

    // Advance next_date if completed
    if (form.execution_status === "completado" && schedule) {
      const nextDate = form.next_date_override || calcNextDate(schedule);
      if (nextDate) {
        await supabase
          .from("maintenance_schedules")
          .update({ next_date: nextDate, last_executed_at: form.executed_at })
          .eq("id", form.schedule_id);
      }
    }

    setSaving(false);
    setShowForm(false);
    router.refresh();
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Ejecuciones</h1>
        {canExecute && (
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); setError(""); }}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Registrar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["pendientes", "recientes"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "pendientes" && (
        <div className="space-y-2">
          {schedules.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">Sin mantenimientos activos.</p>
          )}
          {schedules.map((s: any) => {
            const overdue = s.next_date && s.next_date < today;
            const soon = s.next_date && s.next_date >= today &&
              s.next_date <= new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
            return (
              <div
                key={s.id}
                className={`rounded-xl border bg-white p-4 flex items-start justify-between gap-4 ${overdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {s.equipment?.code} — {s.equipment?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.maintenance_type} · {s.equipment?.sectors?.plants?.name} · {s.equipment?.sectors?.name}
                    {s.assigned_user?.full_name && ` · ${s.assigned_user.full_name}`}
                    {s.estimated_hours && ` · ${s.estimated_hours} h`}
                  </p>
                  {s.description && (
                    <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className={`text-xs font-semibold text-right ${overdue ? "text-red-700" : soon ? "text-yellow-700" : "text-gray-600"}`}>
                    {s.next_date ? new Date(s.next_date + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                  </div>
                  {canExecute && (
                    <button
                      onClick={() => openFor(s.id)}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors whitespace-nowrap"
                    >
                      Registrar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "recientes" && (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
          {executions.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">Sin ejecuciones registradas.</p>
          )}
          {executions.map((e: any) => (
            <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {e.schedule?.equipment?.code} — {e.schedule?.equipment?.name}
                </p>
                <p className="text-xs text-gray-500">
                  {e.schedule?.maintenance_type} · {e.executor?.full_name}
                  {e.duration_hours && ` · ${e.duration_hours} h`}
                </p>
                {e.observations && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{e.observations}</p>
                )}
              </div>
              <div className="shrink-0 text-right space-y-0.5">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[e.execution_status] ?? "bg-gray-100 text-gray-600"}`}>
                  {e.execution_status}
                </span>
                <p className="text-xs text-gray-400">
                  {new Date(e.executed_at).toLocaleDateString("es-AR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">Registrar ejecución</h2>

            <div className="space-y-3">
              <Field label="Mantenimiento" required>
                <select value={form.schedule_id} onChange={(e) => field("schedule_id", e.target.value)} className="input">
                  <option value="">Seleccioná...</option>
                  {schedules.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.equipment?.code} — {s.equipment?.name} ({s.maintenance_type})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado">
                  <select value={form.execution_status} onChange={(e) => field("execution_status", e.target.value)} className="input">
                    <option value="completado">Completado</option>
                    <option value="parcial">Parcial</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </Field>
                <Field label="Duración (horas)">
                  <input type="number" min="0" step="0.5" value={form.duration_hours}
                    onChange={(e) => field("duration_hours", e.target.value)}
                    placeholder="—" className="input" />
                </Field>
              </div>

              <Field label="Fecha y hora de ejecución">
                <input type="datetime-local" value={form.executed_at}
                  onChange={(e) => field("executed_at", e.target.value)} className="input" />
              </Field>

              {form.execution_status === "completado" && (
                <Field label="Próxima fecha (dejar vacío para calcular automáticamente)">
                  <input type="date" value={form.next_date_override}
                    onChange={(e) => field("next_date_override", e.target.value)} className="input" />
                </Field>
              )}

              <Field label="Observaciones">
                <textarea value={form.observations} onChange={(e) => field("observations", e.target.value)}
                  rows={3} className="input resize-none"
                  placeholder="Detalle de lo realizado, piezas reemplazadas, anomalías..." />
              </Field>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calcNextDate(schedule: any): string | null {
  if (!schedule.next_date) return null;
  const base = new Date(schedule.next_date + "T00:00:00");
  const INTERVALS: Record<string, number> = {
    DIARIO: 1, SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30,
    TRIMESTRAL: 90, SEMESTRAL: 180, ANUAL: 365,
  };
  if (schedule.schedule_type === "FECHA_FIJA") return null;
  if (schedule.schedule_type === "PERSONALIZADO" && schedule.interval_days) {
    base.setDate(base.getDate() + Number(schedule.interval_days));
  } else {
    const days = INTERVALS[schedule.schedule_type];
    if (!days) return null;
    base.setDate(base.getDate() + days);
  }
  return base.toISOString().split("T")[0];
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
