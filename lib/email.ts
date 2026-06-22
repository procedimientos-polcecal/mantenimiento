import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "mantenimiento@polcecal.com.ar";
const TO_DEFAULT = process.env.EMAIL_ALERTS_TO ?? "";

export async function sendOverdueAlert(items: {
  code: string;
  name: string;
  maintenance_type: string;
  next_date: string;
  days_overdue: number;
  assigned_to?: string;
}[]) {
  if (!process.env.RESEND_API_KEY || items.length === 0) return;

  const rows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace">${i.code}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${i.name}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${i.maintenance_type}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${i.next_date}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:#dc2626;font-weight:bold">${i.days_overdue} días</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb">${i.assigned_to ?? "—"}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:18px">⚠️ Mantenimientos vencidos — POLCECAL/POLYSAN</h1>
        <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${new Date().toLocaleDateString("es-AR", { dateStyle: "full" })}</p>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px">
        <p style="margin:0 0 16px;color:#374151">Hay <strong>${items.length} mantenimiento${items.length > 1 ? "s" : ""} vencido${items.length > 1 ? "s" : ""}</strong> que requieren atención:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px;text-align:left;color:#6b7280">Código</th>
              <th style="padding:8px;text-align:left;color:#6b7280">Equipo</th>
              <th style="padding:8px;text-align:left;color:#6b7280">Tipo</th>
              <th style="padding:8px;text-align:left;color:#6b7280">Fecha prev.</th>
              <th style="padding:8px;text-align:left;color:#6b7280">Vencimiento</th>
              <th style="padding:8px;text-align:left;color:#6b7280">Asignado a</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:20px;padding:12px;background:#fef3c7;border-radius:6px;font-size:13px;color:#92400e">
          Accedé al sistema: <a href="https://mantenimiento-kfi9.vercel.app/mantenimientos" style="color:#1d4ed8">mantenimiento-kfi9.vercel.app</a>
        </div>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to: TO_DEFAULT ? TO_DEFAULT.split(",").map((e) => e.trim()) : [],
    subject: `⚠️ ${items.length} mantenimiento${items.length > 1 ? "s" : ""} vencido${items.length > 1 ? "s" : ""} — POLCECAL/POLYSAN`,
    html,
  });
}

export async function sendExecutionNotification(data: {
  equipment_code: string;
  equipment_name: string;
  maintenance_type: string;
  executor_name: string;
  executed_at: string;
  execution_status: string;
  duration_hours?: number;
  observations?: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const statusColor = data.execution_status === "completado" ? "#16a34a"
    : data.execution_status === "parcial" ? "#d97706" : "#dc2626";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:18px">✅ Mantenimiento registrado</h1>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#6b7280;width:140px">Equipo</td><td style="padding:6px 0;font-weight:bold">${data.equipment_code} — ${data.equipment_name}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Tipo</td><td style="padding:6px 0">${data.maintenance_type}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Estado</td><td style="padding:6px 0"><span style="color:${statusColor};font-weight:bold">${data.execution_status}</span></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Ejecutado por</td><td style="padding:6px 0">${data.executor_name}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Fecha</td><td style="padding:6px 0">${new Date(data.executed_at).toLocaleString("es-AR")}</td></tr>
          ${data.duration_hours ? `<tr><td style="padding:6px 0;color:#6b7280">Duración</td><td style="padding:6px 0">${data.duration_hours} h</td></tr>` : ""}
          ${data.observations ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Observaciones</td><td style="padding:6px 0">${data.observations}</td></tr>` : ""}
        </table>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: FROM,
    to: TO_DEFAULT ? TO_DEFAULT.split(",").map((e) => e.trim()) : [],
    subject: `✅ Mantenimiento registrado: ${data.equipment_code} — ${data.equipment_name}`,
    html,
  });
}
