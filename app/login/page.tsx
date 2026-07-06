"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Mostrar errores devueltos por el callback de OAuth (?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "domain") setError("Solo se permite el ingreso con cuentas @polcecal.com.");
    else if (err === "inactive") setError("Tu usuario está desactivado. Contactá al administrador.");
    else if (err === "oauth") setError("No se pudo completar el ingreso con Google. Intentá de nuevo.");
  }, []);

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "polcecal.com", prompt: "select_account" },
      },
    });
    if (err) { setError(err.message); setGoogleLoading(false); }
    // Si no hay error, el navegador redirige a Google.
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setResetSent(true);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      if (err.message.toLowerCase().includes("email not confirmed")) {
        setError("El email no está confirmado. Contactá al administrador del sistema.");
      } else if (err.message.toLowerCase().includes("invalid login credentials") || err.message.toLowerCase().includes("invalid")) {
        setError("Email o contraseña incorrectos.");
      } else {
        setError(err.message);
      }
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'DM Sans', sans-serif", background: "#F1F5F9" }}>

      {/* Left panel */}
      <div style={{
        width: "45%", background: "#0A0F1C",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "48px", position: "relative", overflow: "hidden",
      }} className="login-left">
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(circle at 20% 80%, rgba(245,158,11,.1) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, rgba(34,197,94,.07) 0%, transparent 50%)`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px)`,
          backgroundSize: "40px 40px", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <PPLogo size={200} />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: "clamp(26px, 3vw, 40px)", color: "#F1F5F9",
            lineHeight: 1.15, marginBottom: 16,
          }}>
            Sistema de<br />
            <span style={{ color: "#F59E0B" }}>Gestión</span> de<br />
            Mantenimiento
          </h1>
          <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, maxWidth: 300 }}>
            Control integral de equipos industriales para plantas POLCECAL y POLYSAN.
          </p>
          <div style={{ display: "flex", gap: 32, marginTop: 40 }}>
            {[{ v: "239", l: "Equipos" }, { v: "2", l: "Plantas" }, { v: "16", l: "Sectores" }].map((s) => (
              <div key={s.l}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 30, color: "#F59E0B" }}>{s.v}</div>
                <div style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#1E2A3A", position: "relative", zIndex: 1 }}>
          © {new Date().getFullYear()} POLCECAL / POLYSAN S.A.
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 26, color: "#0F172A", marginBottom: 8 }}>
              {mode === "login" ? "Bienvenido" : "Recuperar contraseña"}
            </h2>
            <p style={{ color: "#64748B", fontSize: 14 }}>
              {mode === "login"
                ? "Ingresá con tu cuenta para continuar."
                : "Te enviaremos un email con un enlace para restablecer tu contraseña."}
            </p>
          </div>

          {mode === "login" ? (
            <>
            <button type="button" onClick={handleGoogle} disabled={googleLoading}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                padding: "12px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff",
                fontSize: 14, fontWeight: 600, color: "#0F172A", cursor: "pointer", marginBottom: 16,
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 002.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75z"/>
              </svg>
              {googleLoading ? "Redirigiendo..." : "Continuar con Google"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
              <span style={{ fontSize: 12, color: "#94A3B8" }}>o con tu email</span>
              <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="usuario@empresa.com" className="input" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  Contraseña
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  required placeholder="••••••••" className="input" />
              </div>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "13px", marginTop: 8, fontSize: 15 }}>
                {loading ? "Ingresando..." : "Ingresar →"}
              </button>

              <button type="button"
                onClick={() => { setMode("forgot"); setError(""); setResetSent(false); }}
                style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, cursor: "pointer", textAlign: "center", marginTop: 4 }}>
                ¿Olvidaste tu contraseña?
              </button>
            </form>
            </>
          ) : resetSent ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "14px", fontSize: 14, color: "#15803D" }}>
                Si el email está registrado, te enviamos un enlace para restablecer la contraseña. Revisá tu bandeja de entrada (y el spam).
              </div>
              <button type="button" onClick={() => { setMode("login"); setResetSent(false); setError(""); }}
                className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: 15 }}>
                Volver al inicio
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748B", marginBottom: 6, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required placeholder="usuario@empresa.com" className="input" />
              </div>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "13px", marginTop: 8, fontSize: 15 }}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>

              <button type="button" onClick={() => { setMode("login"); setError(""); }}
                style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, cursor: "pointer", textAlign: "center", marginTop: 4 }}>
                ← Volver al inicio
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .login-left { display: none !important; } }
      `}</style>
    </div>
  );
}

function PPLogo({ size = 200 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="POLYSAN / POLCECAL" width={size} style={{ objectFit: "contain" }} />;
}
