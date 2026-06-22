"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const links = [
  { href: "/dashboard",      label: "Dashboard" },
  { href: "/equipos",        label: "Equipos" },
  { href: "/mantenimientos", label: "Mantenimientos" },
  { href: "/ejecuciones",    label: "Ejecuciones" },
  { href: "/historial",      label: "Historial" },
  { href: "/usuarios",       label: "Usuarios" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4">
      <span className="text-sm font-bold text-gray-800 shrink-0">POLCECAL / POLYSAN</span>
      <div className="flex items-center gap-1 flex-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith(l.href)
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <button
        onClick={signOut}
        className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
      >
        Salir
      </button>
    </nav>
  );
}
