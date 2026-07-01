"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/dashboard",      label: "Dashboard",        icon: IconDash },
  { href: "/equipos",        label: "Equipos",          icon: IconEquip },
  { href: "/mantenimientos", label: "Mantenimientos",   icon: IconMant },
  { href: "/ejecuciones",    label: "Ejecuciones",      icon: IconExec },
  { href: "/ordenes",        label: "Órdenes de Trabajo", icon: IconOT },
  { href: "/planificacion",  label: "Planificación",      icon: IconPlan },
  { href: "/historial",      label: "Historial",        icon: IconHist },
  { href: "/usuarios",       label: "Usuarios",         icon: IconUsers },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <PPLogo width={56} />
        <button onClick={() => setOpen(true)} style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 39 }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${open ? " open" : ""}`}>
        {/* Brand */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1E2A3A" }}>
          <PPLogo width={160} />
          <div style={{ marginTop: 6, fontSize: 10, color: "#475569", fontFamily: "'DM Sans', sans-serif", letterSpacing: ".06em", textTransform: "uppercase", textAlign: "center" }}>
            Gestión de Mantenimiento
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 8,
                  marginBottom: 2,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: active ? 600 : 400,
                  fontSize: 14,
                  color: active ? "#F59E0B" : "#94A3B8",
                  background: active ? "#1A2840" : "transparent",
                  borderLeft: active ? "2px solid #F59E0B" : "2px solid transparent",
                  textDecoration: "none",
                  transition: "all .15s",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#131D2E"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Icon active={active} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid #1E2A3A" }}>
          <button
            onClick={signOut}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "9px 12px", borderRadius: 8,
              background: "none", border: "none", cursor: "pointer",
              color: "#475569", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              transition: "all .15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#131D2E"; (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#475569"; }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── Logo ─── */
function PPLogo({ width = 160 }: { width?: number }) {
  return (
    <Image src="/logo.png" alt="POLYSAN / POLCECAL" width={width} height={width} style={{ objectFit: "contain" }} />
  );
}

/* ─── Nav Icons ─── */
function IconDash({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}
function IconEquip({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IconMant({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconExec({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconHist({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconPlan({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconOT({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconUsers({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" stroke={active ? "#F59E0B" : "#475569"} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
