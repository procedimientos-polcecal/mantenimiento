"use client";

import { useEffect, useState, useCallback } from "react";
import { useConfirm } from "@/app/components/ConfirmProvider";

const EMPTY = {
  proveedor: "", precio_unitario: "", iva: "0.21", precio_total: "",
  vigencia_hasta: "", plazos: "", condiciones_pago: "", otras_especificaciones: "",
};

function fmtMoney(v: any): string {
  const n = Number(v);
  if (v == null || v === "" || isNaN(n)) return (v ?? "").toString(); // conserva textos tipo "U$D 286"
  return `$${n.toLocaleString("es-AR")}`;
}

export default function ComparativaModal({ os, canEdit, onClose }: {
  os: any; canEdit: boolean; onClose: () => void;
}) {
  const confirm = useConfirm();
  const [rows, setRows]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]     = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/comparativas?os_number=${os.os_number}`);
    const d = await res.json();
    setRows(d.data ?? []);
    setLoading(false);
  }, [os.os_number]);

  useEffect(() => { load(); }, [load]);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.proveedor.trim()) { setError("El proveedor es obligatorio."); return; }
    setSaving(true); setError("");
    // Si no cargaron total y ambos son numéricos, lo calculamos (unitario * (1+iva)).
    let precioTotal = form.precio_total.trim();
    const pu = Number(form.precio_unitario), iva = Number(form.iva);
    if (!precioTotal && !isNaN(pu) && form.precio_unitario.trim() !== "") {
      precioTotal = String(Math.round(pu * (1 + (isNaN(iva) ? 0 : iva)) * 100) / 100);
    }
    const res = await fetch("/api/comparativas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ os_number: os.os_number, ...form, precio_total: precioTotal }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setError(d.error ?? "Error al agregar"); return; }
    setForm({ ...EMPTY }); setShowForm(false); load();
  }

  async function toggleEleccion(r: any) {
    setBusy(r.id);
    await fetch("/api/comparativas", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, eleccion: !r.eleccion }),
    });
    setBusy(null); load();
  }

  async function borrar(r: any) {
    const ok = await confirm({ title: "Eliminar cotización", message: `Se quitará la cotización de "${r.proveedor}" de la comparativa y de la planilla.`, confirmText: "Eliminar", danger: true });
    if (!ok) return;
    setBusy(r.id);
    await fetch(`/api/comparativas?id=${r.id}`, { method: "DELETE" });
    setBusy(null); load();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
              Comparativa de proveedores — OS #{os.os_number}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {[os.sector_raw, os.equipo_raw, os.descripcion].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Cargando...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            Sin cotizaciones cargadas para esta OS.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">Proveedor</th>
                  <th className="px-2 py-2 text-right font-semibold">P. unitario</th>
                  <th className="px-2 py-2 text-right font-semibold">IVA</th>
                  <th className="px-2 py-2 text-right font-semibold">P. total</th>
                  <th className="px-2 py-2 text-left font-semibold">Vigencia</th>
                  <th className="px-2 py-2 text-left font-semibold">Plazos</th>
                  <th className="px-2 py-2 text-left font-semibold">Cond. pago</th>
                  <th className="px-2 py-2 text-left font-semibold">Otras</th>
                  <th className="px-2 py-2 text-center font-semibold">Elegido</th>
                  {canEdit && <th className="px-2 py-2"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} style={r.eleccion ? { background: "#F0FDF4" } : undefined}>
                    <td className="px-2 py-2 font-medium text-gray-800">{r.proveedor}</td>
                    <td className="px-2 py-2 text-right text-gray-600 whitespace-nowrap">{fmtMoney(r.precio_unitario)}</td>
                    <td className="px-2 py-2 text-right text-gray-500">{r.iva != null ? `${Math.round(r.iva * 100)}%` : "—"}</td>
                    <td className="px-2 py-2 text-right font-semibold text-gray-800 whitespace-nowrap">{fmtMoney(r.precio_total)}</td>
                    <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{r.vigencia_hasta ? new Date(r.vigencia_hasta).toLocaleDateString("es-AR") : "—"}</td>
                    <td className="px-2 py-2 text-gray-500">{r.plazos ?? "—"}</td>
                    <td className="px-2 py-2 text-gray-500">{r.condiciones_pago ?? "—"}</td>
                    <td className="px-2 py-2 text-gray-500 max-w-[160px] truncate" title={r.otras_especificaciones ?? ""}>{r.otras_especificaciones ?? "—"}</td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => canEdit && toggleEleccion(r)} disabled={!canEdit || busy === r.id}
                        title={r.eleccion ? "Proveedor elegido" : "Marcar como elegido"}
                        className={`text-base ${r.eleccion ? "text-green-600" : "text-gray-300 hover:text-gray-500"} disabled:cursor-default`}>
                        {r.eleccion ? "★" : "☆"}
                      </button>
                    </td>
                    {canEdit && (
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => borrar(r)} disabled={busy === r.id}
                          className="text-gray-300 hover:text-red-600" title="Eliminar">×</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit && !showForm && (
          <button onClick={() => { setForm({ ...EMPTY }); setError(""); setShowForm(true); }}
            className="btn-primary">+ Agregar cotización</button>
        )}

        {canEdit && showForm && (
          <form onSubmit={agregar} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700">Nueva cotización · sector {os.sector_raw ?? "Otros"}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Fld label="Proveedor *"><input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} className="input" /></Fld>
              <Fld label="Precio unitario"><input value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: e.target.value })} className="input" placeholder="Ej: 250000 o U$D 286" /></Fld>
              <Fld label="IVA"><input value={form.iva} onChange={(e) => setForm({ ...form, iva: e.target.value })} className="input" placeholder="0.21" /></Fld>
              <Fld label="Precio total"><input value={form.precio_total} onChange={(e) => setForm({ ...form, precio_total: e.target.value })} className="input" placeholder="Se calcula si lo dejás vacío" /></Fld>
              <Fld label="Vigencia hasta"><input type="date" value={form.vigencia_hasta} onChange={(e) => setForm({ ...form, vigencia_hasta: e.target.value })} className="input" /></Fld>
              <Fld label="Plazos"><input value={form.plazos} onChange={(e) => setForm({ ...form, plazos: e.target.value })} className="input" placeholder="Ej: 15 días" /></Fld>
              <Fld label="Condiciones de pago"><input value={form.condiciones_pago} onChange={(e) => setForm({ ...form, condiciones_pago: e.target.value })} className="input" /></Fld>
              <div className="md:col-span-2"><Fld label="Otras especificaciones"><input value={form.otras_especificaciones} onChange={(e) => setForm({ ...form, otras_especificaciones: e.target.value })} className="input" /></Fld></div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">{saving ? "Guardando..." : "Agregar a la planilla"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            </div>
          </form>
        )}
        {error && !showForm && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="block text-xs font-medium text-gray-600">{label}</label>{children}</div>;
}
