"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InfoTip from "@/app/components/InfoTip";
import { useConfirm } from "@/app/components/ConfirmProvider";

export default function ConfiguracionClient({ sectors, plants }: {
  sectors: any[]; plants: any[];
}) {
  const router = useRouter();
  const confirm = useConfirm();

  const [editId, setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState("");

  // Nuevo sector
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlant, setNewPlant] = useState("");
  const [error, setError]     = useState("");

  // Import BD de equipos
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function importBD(file: File | null) {
    if (!file) return;
    setImporting(true); setImportMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/equipos/import-bd", { method: "POST", body: fd });
    const d = await res.json();
    setImporting(false);
    if (!res.ok) { setImportMsg({ text: d.error ?? "Error al importar", ok: false }); return; }
    const noEnc = (d.no_encontrados?.length ?? 0);
    setImportMsg({
      ok: true,
      text: `✓ ${d.tipos} tipos, ${d.equipos} equipos y ${d.componentes} componentes importados${noEnc ? ` · ${noEnc} códigos no encontrados en la app` : ""}.`,
    });
  }

  function startEdit(s: any) {
    setEditId(s.id); setEditName(s.name); setMsg("");
  }

  async function saveEdit(s: any) {
    if (!editName.trim() || editName.trim() === s.name) { setEditId(null); return; }
    const ok = await confirm({
      title: "Renombrar sector",
      message: `El sector "${s.name}" pasará a llamarse "${editName.trim()}". Los equipos y datos vinculados no se ven afectados (se relacionan por ID). ¿Confirmás?`,
      confirmText: "Renombrar",
    });
    if (!ok) return;
    setBusy(true); setMsg("");
    const res = await fetch("/api/sectores", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, name: editName.trim() }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json(); setMsg(d.error ?? "Error"); return; }
    setEditId(null);
    router.refresh();
  }

  async function createSector(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPlant) { setError("Completá nombre y planta."); return; }
    setBusy(true); setError("");
    const res = await fetch("/api/sectores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), plant_id: newPlant }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error al crear."); return; }
    setShowNew(false); setNewName(""); setNewPlant("");
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          Configuración
          <InfoTip text="Sección exclusiva del administrador de sistema para editar la información base de la app: sectores, equipos, usuarios y contraseñas." />
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">Información base del sistema — solo administrador de sistema.</p>
      </div>

      {/* Sectores */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
            Sectores
            <InfoTip text="Renombrá o creá sectores. Renombrar no rompe vínculos: los equipos y OTs se relacionan por ID, no por el nombre. Ojo: si renombrás acá, conviene usar el mismo nombre en la planilla de Google Sheets." />
          </h2>
          <button onClick={() => { setShowNew(true); setError(""); }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            + Nuevo sector
          </button>
        </div>

        {msg && <p className="text-sm text-red-600 mb-2">{msg}</p>}

        <div className="divide-y divide-gray-100">
          {sectors.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5">
              {editId === s.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="input flex-1" autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s); if (e.key === "Escape") setEditId(null); }} />
                  <button onClick={() => saveEdit(s)} disabled={busy}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">Guardar</button>
                  <button onClick={() => setEditId(null)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">Cancelar</button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{s.plants?.name}</span>
                  </div>
                  <button onClick={() => startEdit(s)}
                    className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors">Renombrar</button>
                </>
              )}
            </div>
          ))}
          {sectors.length === 0 && <p className="text-sm text-gray-400 py-4">Sin sectores.</p>}
        </div>
      </section>

      {/* Accesos a otra info base */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
          Otra información base
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ConfigLink href="/usuarios" title="Usuarios y contraseñas"
            desc="Crear, editar o desactivar usuarios, cambiar roles y contraseñas." />
          <ConfigLink href="/equipos" title="Equipos"
            desc="Editar datos de equipos, estado, criticidad, sector e importar desde Excel." />
          <ConfigLink href="/configuracion/tipos" title="Tipos de equipo"
            desc="Crear o editar los tipos de equipo y sus datos de referencia (lubricante, rodamientos, frecuencias)." />
        </div>
      </section>

      {/* Importar BD de equipos */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2" style={{ fontFamily: "'Syne', sans-serif" }}>
          Importar BD de equipos
          <InfoTip text="Subí el Excel 'BD Equipos v3'. Importa la ficha técnica de cada equipo (match por código), los tipos de equipo y los componentes. Solo actualiza equipos que ya existen en la app; los campos vacíos del Excel no pisan datos cargados." />
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Lee las hojas <b>EQUIPOS</b>, <b>TIPO_EQUIPO</b> y <b>COMPONENTES</b>. Las tareas PM no se importan.
        </p>
        <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-2.5 hover:border-amber-400 transition-colors">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-sm text-gray-600">{importing ? "Importando..." : "Elegir archivo Excel (.xlsx)"}</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing}
            onChange={(e) => importBD(e.target.files?.[0] ?? null)} />
        </label>
        {importMsg && (
          <p className={`text-sm mt-3 ${importMsg.ok ? "text-green-600" : "text-red-600"}`}>{importMsg.text}</p>
        )}
      </section>

      {/* Nuevo sector */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={createSector} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-gray-900">Nuevo sector</h2>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Nombre</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="input" autoFocus />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600">Planta</label>
              <select value={newPlant} onChange={(e) => setNewPlant(e.target.value)} className="input">
                <option value="">Seleccioná...</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
                {busy ? "Creando..." : "Crear sector"}
              </button>
              <button type="button" onClick={() => setShowNew(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ConfigLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href}
      className="rounded-xl border border-gray-200 p-4 hover:border-amber-300 hover:bg-amber-50/40 transition-colors block">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </Link>
  );
}
