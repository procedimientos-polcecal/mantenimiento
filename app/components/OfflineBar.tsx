"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";

export default function OfflineBar() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    async function checkPending() {
      try {
        const count = await db.pending_executions.where("synced").equals(0).count();
        setPending(count);
      } catch {}
    }
    checkPending();
    const interval = setInterval(checkPending, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (online && pending > 0) syncPending();
  }, [online]);

  async function syncPending() {
    setSyncing(true);
    try {
      const rows = await db.pending_executions.where("synced").equals(0).toArray();
      for (const row of rows) {
        const res = await fetch("/api/ejecuciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        });
        if (res.ok && row.id != null) {
          await db.pending_executions.update(row.id, { synced: 1 as any });
        }
      }
      const count = await db.pending_executions.where("synced").equals(0).count();
      setPending(count);
    } catch {}
    setSyncing(false);
  }

  if (online && pending === 0) return null;

  return (
    <div className={`px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-3 ${online ? "bg-yellow-50 text-yellow-800 border-b border-yellow-200" : "bg-red-50 text-red-800 border-b border-red-200"}`}>
      {!online && <span>📡 Sin conexión — las ejecuciones se guardan localmente</span>}
      {online && pending > 0 && (
        <>
          <span>🔄 {pending} ejecución{pending > 1 ? "es" : ""} pendiente{pending > 1 ? "s" : ""} de sincronizar</span>
          <button
            onClick={syncPending}
            disabled={syncing}
            className="underline hover:no-underline disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        </>
      )}
    </div>
  );
}
