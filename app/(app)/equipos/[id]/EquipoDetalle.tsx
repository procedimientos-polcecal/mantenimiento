"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const STATUS_OPTIONS = [
  { value: "OPERATIVO",         label: "Operativo" },
  { value: "EN_MANTENIMIENTO",  label: "En mantenimiento" },
  { value: "EN_REPARACION",     label: "En reparación" },
  { value: "STANDBY",           label: "Standby" },
  { value: "FUERA_DE_SERVICIO", label: "Fuera de servicio" },
  { value: "DADO_DE_BAJA",      label: "Dado de baja" },
];

const CRITICALITY_OPTIONS = [
  { value: "ALTA",  label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA",  label: "Baja" },
];

const STATUS_COLORS: Record<string, string> = {
  OPERATIVO:          "bg-green-100 text-green-800",
  EN_MANTENIMIENTO:   "bg-blue-100 text-blue-800",
  EN_REPARACION:      "bg-red-100 text-red-800",
  STANDBY:            "bg-yellow-100 text-yellow-800",
  FUERA_DE_SERVICIO:  "bg-gray-100 text-gray-600",
  DADO_DE_BAJA:       "bg-slate-100 text-slate-500",
};

export default function EquipoDetalle({ equipo, sectors, historial, canEdit, userId }: {
  equipo: any;
  sectors: any[];
  historial: any[];
  canEdit: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name:        equipo.name,
    code:        equipo.code,
    sector_id:   equipo.sector_id,
    power_kw:    equipo.power_kw ?? "",
    description: equipo.description ?? "",
    status:      equipo.status,
    criticality: equipo.criticality,
    notes:       equipo.notes ?? "",
  });

  function field(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const supabase = createClient();

    const payload: any = {
      name:        form.name.trim(),
      code:        form.code.trim(),
      sector_id:   form.sector_id,
      power_kw:    form.power_kw === "" ? null : Number(form.power_kw),
      description: form.description.trim() || null,
      criticality: form.criticality,
      notes:       form.notes.trim() || null,
    };

    const statusChanged = form.status !== equipo.status;
    if (statusChanged) payload.status = form.status;

    const { error: err } = await supabase
      .from("equipment")
      .update(payload)
      .eq("id", equipo.id);

    if (err) { setError(err.message); setSaving(false); return; }

    if (statusChanged) {
      await supabase.from("equipment_status_log").insert({
        equipment_id: equipo.id,
        old_status:   equipo.status,
        new_status:   form.status,
        changed_by:   userId,
      });
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  const statusLabel = STATUS_OPTIONS.find((s) => s.value === equipo.status)?.label ?? equipo.status;
  const statusColor = STATUS_COLORS[equipo.status] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/equipos" className="text-sm text-gray-400 hover:text-gray-700">← Equipos</Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{equipo.name}</h1>
          <p className="text-sm font-mono text-gray-400">{equipo.code}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {equipo.sectors?.plants?.name} · {equipo.sectors?.name}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* View mode */}
      {!editing && (
        <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          <Row label="Descripción" value={equipo.description || "—"} />
          <Row label="Potencia" value={equipo.power_kw != null ? `${equipo.power_kw} kW` : "—"} />
          <Row label="Criticidad" value={equipo.criticality} />
          <Row label="Observaciones" value={equipo.notes || "—"} />
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre" required>
              <input value={form.name} onChange={(e) => field("name", e.target.value)}
                className="input" />
            </Field>
            <Field label="Código" required>
              <input value={form.code} onChange={(e) => field("code", e.target.value)}
                className="input" />
            </Field>
          </div>

          <Field label="Sector" required>
            <select value={form.sector_id} onChange={(e) => field("sector_id", e.target.value)}
              className="input">
              {sectors.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.plants?.name} · {s.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Estado">
              <select value={form.status} onChange={(e) => field("status", e.target.value)}
                className="input">
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Criticidad">
              <select value={form.criticality} onChange={(e) => field("criticality", e.target.value)}
                className="input">
                {CRITICALITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Potencia (kW)">
              <input type="number" value={form.power_kw} onChange={(e) => field("power_kw", e.target.value)}
                placeholder="—" className="input" />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea value={form.description} onChange={(e) => field("description", e.target.value)}
              rows={2} className="input resize-none" />
          </Field>

          <Field label="Observaciones">
            <textarea value={form.notes} onChange={(e) => field("notes", e.target.value)}
              rows={2} className="input resize-none" />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button
              onClick={() => { setEditing(false); setError(""); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Status history */}
      {historial.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Historial de estado</h2>
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {historial.map((h: any) => (
              <div key={h.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 line-through text-xs">{h.old_status}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-800">{h.new_status}</span>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <div>{h.changed_by_user?.full_name ?? "—"}</div>
                  <div>{new Date(h.changed_at).toLocaleDateString("es-AR")}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex gap-4">
      <span className="text-sm text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
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
