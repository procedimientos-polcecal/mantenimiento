"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);      // hay sesión de recuperación válida
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // El link de recuperación puede llegar como ?code=... (PKCE) o con tokens
    // en el hash (#). detectSessionInUrl del browser client maneja el hash;
    // para el code lo intercambiamos manualmente.
    async function init() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) { setError("El enlace no es válido o expiró. Pedí uno nuevo."); setChecking(false); return; }
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      else setError("El enlace no es válido o expiró. Pedí uno nuevo.");
      setChecking(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") { setReady(true); setChecking(false); }
    });

    init();
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    // Cerramos la sesión de recuperación y mandamos al login
    await supabase.auth.signOut();
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", background: "#F1F5F9", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="POLYSAN / POLCECAL" width={160} style={{ objectFit: "contain", display: "inline-block" }} />
        </div>

        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 28 }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 22, color: "#0F172A", marginBottom: 8 }}>
            Nueva contraseña
          </h2>

          {checking ? (
            <p style={{ color: "#64748B", fontSize: 14, marginTop: 12 }}>Verificando el enlace...</p>
          ) : done ? (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 14, fontSize: 14, color: "#15803D", marginTop: 12 }}>
              ✓ Contraseña actualizada. Te estamos redirigiendo al inicio de sesión...
            </div>
          ) : ready ? (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
              <p style={{ color: "#64748B", fontSize: 14 }}>Ingresá tu nueva contraseña (mínimo 8 caracteres).</p>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  Nueva contraseña
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required placeholder="••••••••" className="input" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  Repetir contraseña
                </label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  required placeholder="••••••••" className="input" />
              </div>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: 15 }}>
                {loading ? "Guardando..." : "Guardar contraseña"}
              </button>
            </form>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: 14, fontSize: 14, color: "#DC2626" }}>
                {error || "El enlace no es válido o expiró."}
              </div>
              <button onClick={() => router.push("/login")} className="btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: 15, marginTop: 16 }}>
                Volver al inicio
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
