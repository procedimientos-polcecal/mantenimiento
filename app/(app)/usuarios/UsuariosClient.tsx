"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "admin_sistema",  label: "Admin sistema" },
  { value: "administrador",  label: "Administrador" },
  { value: "gerente",        label: "Gerente" },
  { value: "operario",       label: "Operario" },
];

const EMPTY_FORM = { full_name: "", email: "", role: "operario", password: "" };

export default function UsuariosClient({ users }: { users: any[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function field(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(u: any) {
    setForm({ full_name: u.full_name, email: u.email, role: u.role, password: "" });
    setEditing(u);
    setShowForm(true);
    setError("");
  }

  async function save() {
    if (!form.full_name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError("");

    if (editing) {
      // PATCH — update name, role, and optionally password
      if (form.password && form.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:        editing.id,
          full_name: form.full_name.trim(),
          role:      form.role,
          password:  form.password || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error al actualizar."); setSaving(false); return; }
    } else {
      if (!form.email.trim()) { setError("El email es obligatorio."); setSaving(false); return; }
      if (!form.password || form.password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email:     form.email.trim(),
          password:  form.password,
          role:      form.role,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error al crear usuario."); setSaving(false); return; }
    }

    setSaving(false);
    setShowForm(false);
    router.refresh();
  }

  async function toggleActive(u: any) {
    const supabase = createClient();
    await supabase
      .from("app_users")
      .update({ is_active: !u.is_active })
      .eq("id", u.id);
    router.refresh();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
        <button
          onClick={openNew}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Nuevo
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
        {users.map((u: any) => (
          <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className={`text-sm font-medium ${u.is_active ? "text-gray-900" : "text-gray-400 line-through"}`}>
                {u.full_name}
              </p>
              <p className="text-xs text-gray-500">{u.email} · {ROLES.find((r) => r.value === u.role)?.label ?? u.role}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => openEdit(u)}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors">
                Editar
              </button>
              <button onClick={() => toggleActive(u)}
                className={`rounded px-2 py-1 text-xs transition-colors ${u.is_active ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}>
                {u.is_active ? "Desactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-gray-900">
              {editing ? "Editar usuario" : "Nuevo usuario"}
            </h2>
            <div className="space-y-3">
              <Field label="Nombre completo" required>
                <input value={form.full_name} onChange={(e) => field("full_name", e.target.value)} className="input" />
              </Field>
              {!editing && (
                <Field label="Email" required>
                  <input type="email" value={form.email} onChange={(e) => field("email", e.target.value)} className="input" />
                </Field>
              )}
              <Field label={editing ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"} required={!editing ? true : false}>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => field("password", e.target.value)}
                  className="input"
                  placeholder={editing ? "Nueva contraseña..." : "Mínimo 6 caracteres"}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Rol">
                <select value={form.role} onChange={(e) => field("role", e.target.value)} className="input">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
