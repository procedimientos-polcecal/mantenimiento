"use client";

import { useState } from "react";
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
