"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TYPE_OPTIONS = [
  { value: "Lubricacion",       label: "Lubricación" },
  { value: "Inspeccion",        label: "Inspección" },
  { value: "Limpieza",          label: "Limpieza" },
  { value: "Ajuste",            label: "Ajuste" },
  { value: "Reemplazo",         label: "Reemplazo" },
  { value: "Revision_electrica",label: "Revisión eléctrica" },
  { value: "Otro",              label: "Otro" },
];

const SCHEDULE_OPTIONS = [
  { value: "DIARIO",     label: "Diario" },
  { value: "SEMANAL",    label: "Semanal" },
  { value: "QUINCENAL",  label: "Quincenal" },
  { value: "MENSUAL",    label: "Mensual" },
  { value: "TRIMESTRAL", label: "Trimestral" },
  { value: "SEMESTRAL",  label: "Semestral" },
  { value: "ANUAL",      label: "Anual" },
  { value: "PERSONALIZADO", label: "Personalizado (días)" },
  { value: "FECHA_FIJA", label: "Fecha fija (única)" },
];

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-100 text-green-800",
  paused:    "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const EMPTY_FORM = {
  equipment_id:    "",
  maintenance_type:"Inspeccion",
  schedule_type:   "MENSUAL",
  interval_days:   "",
  next_date:       "",
  assigned_to:     "",
  description:     "",
  estimated_hours: "",
};

export default function MantenimientosClient({ schedules, equipment, users, canEdit, currentUserId }: {
  schedules: any[];
  equipment: any[];
  users: any[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [refPhotos, setRefPhotos] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);

  function handleRefPhotos(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 3);
    setRefPhotos((p) => [...p, ...arr].slice(0, 3));
    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setRefPreviews((p) => [...p, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  }

  function removeRefPhoto(idx: number) {
    setRefPhotos((p) => p.filter((_, i) => i !== idx));
    setRefPreviews((p) => p.filter((_, i) => i !== idx));
  }

  async function uploadRefPhotos(scheduleId: string): Promise<string[]> {
    if (refPhotos.length === 0) return [];
    const supabase = createClient();
    const urls: string[] = [];
    for (const photo of refPhotos) {
      const ext = photo.name.split(".").pop() ?? "jpg";
      const path = `schedules/${scheduleId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("execution-photos")
        .upload(path, photo, { upsert: false });
      if (!error) {
        const { data } = supabase.storage.from("execution-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  function field(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setRefPhotos([]);
    setRefPreviews([]);
    setShowForm(true);
    setError("");
  }

  function openEdit(s: any) {
    setForm({
      equipment_id:    s.equipment_id,
      maintenance_type:s.maintenance_type,
      schedule_type:   s.schedule_type,
      interval_days:   s.interval_days ?? "",
      next_date:       s.next_date ?? "",
      assigned_to:     s.assigned_to ?? "",
      description:     s.description ?? "",
      estimated_hours: s.estimated_hours ?? "",
    });
    setEditing(s);
    setRefPhotos([]);
    setRefPreviews([]);
    setShowForm(true);
    setError("");
  }

  async function save() {
    if (!form.equipment_id || !form.next_date) {
      setError("Equipo y fecha próxima son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();

    const payload: any = {
      equipment_id:    form.equipment_id,
      maintenance_type:form.maintenance_type,
      schedule_type:   form.schedule_type,
      next_date:       form.next_date,
      assigned_to:     form.assigned_to || null,
      description:     form.description.trim() || null,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      interval_days:
        form.schedule_type === "PERSONALIZADO" && form.interval_days
          ? Number(form.interval_days)
          : null,
    };

    let err;
    if (editing) {
      if (refPhotos.length > 0) {
        const urls = await uploadRefPhotos(editing.id);
        if (urls.length > 0) payload.reference_photos = urls;
      }
      ({ error: err } = await supabase
        .from("maintenance_schedules")
        .update(payload)
        .eq("id", editing.id));
    } else {
      payload.status = "active";
      const { data: inserted, error: insErr } = await supabase
        .from("maintenance_schedules")
        .insert(payload)
        .select("id")
        .single();
      if (!insErr && inserted && refPhotos.length > 0) {
        const urls = await uploadRefPhotos(inserted.id);
        if (urls.length > 0) {
          await supabase
            .from("maintenance_schedules")
            .update({ reference_photos: urls })
            .eq("id", inserted.id);
        }
      }
      err = insErr;
    }

    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    setShowForm(false);
    router.refresh();
  }

  async function toggleStatus(s: any) {
    const supabase = createClient();
    const newStatus = s.status === "active" ? "paused" : "active";
    await supabase
      .from("maintenance_schedules")
      .update({ status: newStatus })
      .eq("id", s.id);
    router.refresh();
  }

  const today = new Date().toISOString().split("T")[0];

  const filtered = schedules.filter((s) =>
    filterStatus ? s.status === filterStatus : true
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">Mantenimientos</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="paused">Pausados</option>
            <option value="cancelled">Cancelados</option>
            <option value="completed">Completados</option>
          </select>
          {canEdit && (
            <button
              onClick={openNew}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              + Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Schedule list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">
            Sin mantenimientos programados.
          </div>
        )}
        {filtered.map((s: any) => {
          const overdue = s.next_date && s.next_date < today && s.status === "active";
          const soon = s.next_date && s.next_date >= today &&
            s.next_date <= new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0] &&
            s.status === "active";

          return (
            <div
              key={s.id}
              className={`rounded-xl border bg-white p-4 ${
                overdue ? "border-red-200 bg-red-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">
                      {s.equipment?.code} — {s.equipment?.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {s.equipment?.sectors?.plants?.name} · {s.equipment?.sectors?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                    <span>{s.maintenance_type}</span>
                    <span>·</span>
                    <span>{SCHEDULE_OPTIONS.find((o) => o.value === s.schedule_type)?.label ?? s.schedule_type}</span>
                    {s.interval_days && <span>· cada {s.interval_days} días</span>}
                    {s.assigned_user?.full_name && (
                      <><span>·</span><span>{s.assigned_user.full_name}</span></>
                    )}
                    {s.estimated_hours && (
                      <><span>·</span><span>{s.estimated_hours} h est.</span></>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${overdue ? "text-red-700" : soon ? "text-yellow-700" : "text-gray-700"}`}>
                      {s.next_date ? new Date(s.next_date + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${STATUS_COLORS[s.status] ?? ""}`}>
                      {s.status}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleStatus(s)}
                        className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        {s.status === "active" ? "Pausar" : "Activar"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-bold text-gray-900">
              {editing ? "Editar mantenimiento" : "Nuevo mantenimiento"}
            </h2>

            <div className="space-y-3">
              <Field label="Equipo" required>
                <select value={form.equipment_id} onChange={(e) => field("equipment_id", e.target.value)} className="input">
                  <option value="">Seleccioná un equipo...</option>
                  {equipment.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.code} — {e.name} ({e.sectors?.plants?.name})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <select value={form.maintenance_type} onChange={(e) => field("maintenance_type", e.target.value)} className="input">
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Frecuencia">
                  <select value={form.schedule_type} onChange={(e) => field("schedule_type", e.target.value)} className="input">
                    {SCHEDULE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {form.schedule_type === "PERSONALIZADO" && (
                <Field label="Cada cuántos días">
                  <input type="number" min="1" value={form.interval_days}
                    onChange={(e) => field("interval_days", e.target.value)} className="input" />
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Próxima fecha" required>
                  <input type="date" value={form.next_date}
                    onChange={(e) => field("next_date", e.target.value)} className="input" />
                </Field>
                <Field label="Horas estimadas">
                  <input type="number" min="0" step="0.5" value={form.estimated_hours}
                    onChange={(e) => field("estimated_hours", e.target.value)}
                    placeholder="—" className="input" />
                </Field>
              </div>

              <Field label="Asignar a">
                <select value={form.assigned_to} onChange={(e) => field("assigned_to", e.target.value)} className="input">
                  <option value="">Sin asignar</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Descripción / tarea">
                <textarea value={form.description} onChange={(e) => field("description", e.target.value)}
                  rows={3} className="input resize-none" placeholder="Detalle de la tarea a realizar..." />
              </Field>

              <Field label="Fotos de referencia (hasta 3)">
                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-3 hover:border-blue-400 transition-colors">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-500">
                    {refPhotos.length === 0 ? "Adjuntar foto..." : `${refPhotos.length} foto(s) seleccionada(s)`}
                  </span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => handleRefPhotos(e.target.files)} />
                </label>
                {refPreviews.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {refPreviews.map((src, i) => (
                      <div key={i} className="relative">
                        <img src={src} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                        <button type="button" onClick={() => removeRefPhoto(i)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            </div>

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
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
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
