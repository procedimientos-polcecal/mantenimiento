"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPERATIVO:          { label: "Operativo",        color: "bg-green-100 text-green-800" },
  EN_MANTENIMIENTO:   { label: "En mantenimiento", color: "bg-blue-100 text-blue-800" },
  EN_REPARACION:      { label: "En reparación",    color: "bg-red-100 text-red-800" },
  STANDBY:            { label: "Standby",           color: "bg-yellow-100 text-yellow-800" },
  FUERA_DE_SERVICIO:  { label: "Fuera de servicio", color: "bg-gray-100 text-gray-600" },
  DADO_DE_BAJA:       { label: "Dado de baja",      color: "bg-slate-100 text-slate-500" },
};

const CRITICALITY_LABELS: Record<string, string> = {
  ALTA:  "text-red-600 font-semibold",
  MEDIA: "text-yellow-600",
  BAJA:  "text-gray-400",
};

export default function EquiposClient({ plants, sectors, equipment }: {
  plants: any[];
  sectors: any[];
  equipment: any[];
}) {
  const [search, setSearch] = useState("");
  const [filterPlant, setFilterPlant] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const router = useRouter();

  const filteredSectors = useMemo(() =>
    filterPlant
      ? sectors.filter((s: any) => s.plants?.name === filterPlant)
      : sectors,
    [sectors, filterPlant]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return equipment.filter((e: any) => {
      if (filterPlant && e.sectors?.plants?.name !== filterPlant) return false;
      if (filterSector && e.sectors?.name !== filterSector) return false;
      if (filterStatus && e.status !== filterStatus) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.code.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [equipment, filterPlant, filterSector, filterStatus, search]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Equipos</h1>
        <span className="text-sm text-gray-500">{filtered.length} de {equipment.length}</span>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input
          type="text"
          placeholder="Buscar nombre o código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="col-span-2 md:col-span-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={filterPlant}
          onChange={(e) => { setFilterPlant(e.target.value); setFilterSector(""); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todas las plantas</option>
          {plants.map((p: any) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todos los sectores</option>
          {filteredSectors.map((s: any) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Equipo</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Planta</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Sector</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">kW</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Criticidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((e: any) => {
              const st = STATUS_LABELS[e.status] ?? { label: e.status, color: "bg-gray-100 text-gray-600" };
              return (
                <tr key={e.id} onClick={() => router.push(`/equipos/${e.id}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {e.name}
                    {e.description && (
                      <p className="text-xs text-gray-400 font-normal truncate max-w-xs">{e.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.sectors?.plants?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{e.sectors?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{e.power_kw ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs ${CRITICALITY_LABELS[e.criticality] ?? ""}`}>
                    {e.criticality}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-400">Sin resultados.</div>
        )}
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-2">
        {filtered.map((e: any) => {
          const st = STATUS_LABELS[e.status] ?? { label: e.status, color: "bg-gray-100 text-gray-600" };
          return (
            <div key={e.id} onClick={() => router.push(`/equipos/${e.id}`)} className="rounded-xl border border-gray-200 bg-white p-4 space-y-1 cursor-pointer active:bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900">{e.name}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-mono">{e.code}</div>
              <div className="text-xs text-gray-500">{e.sectors?.plants?.name} · {e.sectors?.name}</div>
              {e.description && (
                <div className="text-xs text-gray-400 line-clamp-2">{e.description}</div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">Sin resultados.</div>
        )}
      </div>
    </div>
  );
}
