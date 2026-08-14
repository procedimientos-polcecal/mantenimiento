"use client";

import { useEffect, useState, useCallback } from "react";

type Part = { id: string; nombre: string; codigo: string | null; cantidad: string | null };
type Avail = { disponible: boolean | null; match: any; bajoMinimo?: boolean } | undefined;

export default function RepuestosOTModal({ order, onClose }: { order: any; onClose: () => void }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [avail, setAvail] = useState<Record<string, Avail>>({});
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  // Alta de repuesto
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [adding, setAdding] = useState(false);

  const base = `/api/work-orders/${order.id}/parts`;

  const checkAvailability = useCallback(async (list: Part[]) => {
    if (list.length === 0) { setAvail({}); return; }
    setChecking(true);
    const res = await fetch("/api/inventario", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: list.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre })) }),
    });
    const d = await res.json();
    setConfigured(d.configured !== false);
    const map: Record<string, Avail> = {};
    for (const r of d.results ?? []) map[r.id] = { disponible: r.disponible, match: r.match, bajoMinimo: r.bajoMinimo };
    setAvail(map);
    setChecking(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(base);
    const d = await res.json();
    const list: Part[] = d.data ?? [];
    setParts(list);
    setLoading(false);
    checkAvailability(list);
  }, [base, checkAvailability]);

  useEffect(() => { load(); }, [load]);

  // Autocompletar desde el inventario
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/inventario?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      setResults(d.data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function add() {
    if (!nombre.trim()) return;
    setAdding(true);
    await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, codigo, cantidad }) });
    setAdding(false);
    setNombre(""); setCodigo(""); setCantidad(""); setQ(""); setResults([]);
    load();
  }

  async function remove(id: string) {
    await fetch(`${base}?part_id=${id}`, { method: "DELETE" });
    load();
  }

  function pickFromInventory(it: any) {
    setNombre(it.descripcion || it.codigo);
    setCodigo(it.codigo || "");
    setQ(""); setResults([]);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Repuestos necesarios</h2>
            <p className="text-xs text-gray-400 mt-0.5">OT #{order.ot_number} · {order.equipo_raw ?? order.descripcion ?? ""}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {!configured && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            El inventario todavía no está conectado. Podés cargar los repuestos igual; la disponibilidad se mostrará cuando se configure.
          </div>
        )}

        {/* Lista de repuestos */}
        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
        ) : parts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin repuestos cargados para esta OT.</p>
        ) : (
          <div className="space-y-2">
            {checking && <p className="text-xs text-gray-400">Consultando inventario...</p>}
            {parts.map((p) => {
              const a = avail[p.id];
              const disp = a?.disponible;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {[p.codigo && `Cód: ${p.codigo}`, p.cantidad && `Cant: ${p.cantidad}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {configured && (
                    <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full text-right"
                      style={
                        disp === true && a?.bajoMinimo ? { color: "#B45309", background: "#FFFBEB" }
                        : disp === true ? { color: "#16A34A", background: "#F0FDF4" }
                        : disp === false ? { color: "#DC2626", background: "#FEF2F2" }
                        : { color: "#B45309", background: "#FFFBEB" }
                      }>
                      {disp === true && a?.bajoMinimo ? `⚠ Bajo mínimo (${a.match.stock})`
                        : disp === true ? `✓ Disponible${a?.match?.stock != null ? ` (${a.match.stock})` : ""}`
                        : disp === false ? "✗ Falta — pedir"
                        : a?.match ? "En inventario (sin stock informado)" : "No encontrado"}
                    </span>
                  )}
                  <button onClick={() => remove(p.id)} className="shrink-0 text-gray-300 hover:text-red-600" title="Quitar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Agregar */}
        <div className="rounded-xl border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600">Agregar repuesto</p>
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en inventario (código o nombre)..."
              className="input" />
            {(searching || results.length > 0) && q.trim() && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                {searching && <p className="px-3 py-2 text-xs text-gray-400">Buscando...</p>}
                {!searching && results.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">Sin coincidencias en inventario.</p>}
                {results.map((it, i) => (
                  <button key={i} onClick={() => pickFromInventory(it)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 truncate">
                      {it.codigo && <span className="font-mono text-xs text-gray-400 mr-1">{it.codigo}</span>}
                      {it.descripcion}
                    </span>
                    <span className="text-xs shrink-0" style={{ color: (it.stock ?? 0) > 0 ? "#16A34A" : "#DC2626" }}>
                      {it.stock != null ? `stock ${it.stock}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre *" className="input col-span-2" />
            <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cant." className="input" />
          </div>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (opcional)" className="input" />
          <button onClick={add} disabled={adding || !nombre.trim()} className="btn-primary w-full justify-center disabled:opacity-50">
            {adding ? "Agregando..." : "Agregar repuesto"}
          </button>
        </div>
      </div>
    </div>
  );
}
