"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Estados de equipo ofrecidos al iniciar una OT.
const EQ_STATUS = [
  { value: "OPERATIVO",         label: "Operativo",         color: "#16A34A", bg: "#F0FDF4" },
  { value: "EN_MANTENIMIENTO",  label: "En mantenimiento",  color: "#1D4ED8", bg: "#EFF6FF" },
  { value: "EN_REPARACION",     label: "En reparación",     color: "#DC2626", bg: "#FEF2F2" },
  { value: "FUERA_DE_SERVICIO", label: "Fuera de servicio", color: "#64748B", bg: "#F1F5F9" },
];
const REQUIERE_MOTIVO = ["EN_MANTENIMIENTO", "EN_REPARACION", "FUERA_DE_SERVICIO"];
const LABELS: Record<string, string> = Object.fromEntries(EQ_STATUS.map((s) => [s.value, s.label]));

export default function IniciarOTModal({ order, onClose, onDone }: {
  order: any; onClose: () => void; onDone: () => void;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Estado actual del equipo (para preseleccionar y evitar cambios redundantes)
  useEffect(() => {
    if (!order.equipment_id) return;
    createClient().from("equipment").select("status").eq("id", order.equipment_id).single()
      .then(({ data }) => { const st = data?.status ?? "OPERATIVO"; setCurrent(st); setSelected(st); });
  }, [order.equipment_id]);

  const cambiaEquipo = selected && selected !== current;
  const requiereMotivo = cambiaEquipo && REQUIERE_MOTIVO.includes(selected);

  async function confirmar() {
    if (requiereMotivo && !reason.trim()) { setError("Ingresá un motivo para ese estado del equipo."); return; }
    setSaving(true); setError("");

    // 1) La OT pasa a En proceso
    const res = await fetch("/api/work-orders", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id, estado: "EN_PROCESO" }),
    });
    if (!res.ok) { const d = await res.json(); setSaving(false); setError(d.error ?? "Error al iniciar la OT"); return; }

    // 2) Estado del equipo (solo si cambió respecto del actual)
    if (cambiaEquipo) {
      const r2 = await fetch(`/api/equipos/${order.equipment_id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_status", new_status: selected, reason: reason.trim() || null }),
      });
      if (!r2.ok) { const d = await r2.json(); setSaving(false); setError(d.error ?? "OT iniciada, pero falló el cambio de estado del equipo"); return; }
    }

    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            Iniciar OT #{order.ot_number}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{order.equipo_raw ?? order.descripcion ?? ""}</p>
        </div>

        <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          La OT pasa a <b>En proceso</b>. ¿En qué estado queda el equipo mientras se hace el trabajo?
          {current && <span className="block text-blue-500 mt-0.5">Estado actual: {LABELS[current] ?? current}</span>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {EQ_STATUS.map((s) => {
            const sel = selected === s.value;
            return (
              <button key={s.value} onClick={() => { setSelected(s.value); setError(""); }}
                className="rounded-xl border-2 px-3 py-2.5 text-xs font-semibold text-center transition-all"
                style={{ borderColor: sel ? s.color : "#E2E8F0", background: sel ? s.bg : "#fff", color: sel ? s.color : "#64748B" }}>
                {s.label}
                {current === s.value && <span className="block text-[10px] font-normal opacity-70">actual</span>}
              </button>
            );
          })}
        </div>

        {requiereMotivo && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Motivo <span className="text-red-500">*</span></label>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Por qué el equipo queda en ese estado..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
          </div>
        )}

        {!cambiaEquipo && current && (
          <p className="text-xs text-gray-400">El equipo queda como está ({LABELS[current] ?? current}).</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={confirmar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Guardando..." : "Iniciar OT"}
          </button>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
