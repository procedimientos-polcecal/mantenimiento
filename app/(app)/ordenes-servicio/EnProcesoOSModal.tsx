"use client";

import { useEffect, useState } from "react";

function fmtMoney(v: any): string {
  const n = Number(v);
  if (v == null || v === "" || isNaN(n)) return (v ?? "").toString();
  return `$${n.toLocaleString("es-AR")}`;
}

// Modal para pasar una OS a EN PROCESO eligiendo quién lo realiza, a partir
// de los proveedores cotizados en la comparativa de esa OS.
export default function EnProcesoOSModal({ os, onClose, onDone }: {
  os: any; onClose: () => void; onDone: (proveedor: string) => void;
}) {
  const [cots, setCots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<string>("");   // proveedor elegido, o "__otro__"
  const [otro, setOtro] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/comparativas?os_number=${os.os_number}`)
      .then((r) => r.json())
      .then((d) => {
        const rows: any[] = d.data ?? [];
        setCots(rows);
        const elegido = rows.find((r) => r.eleccion);
        if (elegido) setPick(elegido.proveedor);
        else if (os.proveedor_elegido) setPick(os.proveedor_elegido);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [os.os_number, os.proveedor_elegido]);

  // Proveedores únicos de la comparativa (conserva la marca de elegido y el total)
  const proveedores: { proveedor: string; eleccion: boolean; precio_total: any }[] = [];
  const seen = new Set<string>();
  for (const c of cots) {
    if (!c.proveedor || seen.has(c.proveedor)) continue;
    seen.add(c.proveedor);
    proveedores.push({ proveedor: c.proveedor, eleccion: !!c.eleccion, precio_total: c.precio_total });
  }
  // Si el proveedor actual de la OS no está en la comparativa, se ofrece igual.
  if (os.proveedor_elegido && !seen.has(os.proveedor_elegido)) {
    proveedores.push({ proveedor: os.proveedor_elegido, eleccion: false, precio_total: null });
  }

  const proveedorFinal = pick === "__otro__" ? otro.trim() : pick;

  async function confirmar() {
    if (!proveedorFinal) { setError("Elegí quién lo realiza."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/ordenes-servicio", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: os.id, estado: "EN PROCESO", proveedor_elegido: proveedorFinal }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error al actualizar"); return; }
    onDone(proveedorFinal);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: "'Syne', sans-serif" }}>
            OS #{os.os_number} → En proceso
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">¿Quién lo está realizando? (proveedor de la comparativa)</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Cargando comparativa...</div>
        ) : (
          <>
            {proveedores.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Esta OS no tiene comparativa cargada. Podés indicar el proveedor manualmente abajo o cargar la comparativa primero.
              </div>
            ) : (
              <div className="space-y-1.5">
                {proveedores.map((p) => {
                  const sel = pick === p.proveedor;
                  return (
                    <button key={p.proveedor} onClick={() => { setPick(p.proveedor); setError(""); }}
                      className="w-full flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm transition-all"
                      style={{ borderColor: sel ? "#B45309" : "#E2E8F0", background: sel ? "#FFFBEB" : "#fff" }}>
                      <span className="w-3.5 h-3.5 rounded-full border-2 shrink-0" style={{ borderColor: sel ? "#B45309" : "#CBD5E1", background: sel ? "#B45309" : "#fff" }} />
                      <span className="flex-1 min-w-0 truncate text-gray-800">{p.proveedor}</span>
                      {p.eleccion && <span className="text-green-600 text-xs shrink-0" title="Elegido en la comparativa">★ elegido</span>}
                      {p.precio_total != null && <span className="text-xs text-gray-400 shrink-0">{fmtMoney(p.precio_total)}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Otro proveedor (manual) */}
            <button onClick={() => { setPick("__otro__"); setError(""); }}
              className="w-full flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm transition-all"
              style={{ borderColor: pick === "__otro__" ? "#B45309" : "#E2E8F0", background: pick === "__otro__" ? "#FFFBEB" : "#fff" }}>
              <span className="w-3.5 h-3.5 rounded-full border-2 shrink-0" style={{ borderColor: pick === "__otro__" ? "#B45309" : "#CBD5E1", background: pick === "__otro__" ? "#B45309" : "#fff" }} />
              <span className="text-gray-600">Otro (manual)</span>
            </button>
            {pick === "__otro__" && (
              <input value={otro} onChange={(e) => setOtro(e.target.value)} autoFocus
                placeholder="Nombre del proveedor / quién lo realiza"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={confirmar} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Guardando..." : "Pasar a En proceso"}
              </button>
              <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
