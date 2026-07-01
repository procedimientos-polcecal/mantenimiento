"use client";

import { useEffect } from "react";

export default function ImprimirClient({ plan, items }: { plan: any; items: any[] }) {
  const planDate = new Date(plan.fecha + "T12:00:00");
  const fechaStr = planDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  useEffect(() => {
    // Small delay so styles load before print dialog
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Print controls — hidden on print */}
      <div className="no-print fixed top-4 right-4 z-10 flex gap-2">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
        <button onClick={() => window.close()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50 transition-colors">
          Cerrar
        </button>
      </div>

      <style>{`
        @page { size: A4 portrait; margin: 12mm 14mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .ot-page { page-break-after: always; }
          .ot-page:last-child { page-break-after: avoid; }
        }
        body { background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; }
        .ot-page {
          width: 182mm; margin: 0 auto 20mm;
          background: white; border: 1px solid #ddd;
        }
        @media print { .ot-page { width: 100%; margin: 0; border: none; } }
      `}</style>

      <div className="py-8 px-4">
        {items.map((item, idx) => {
          const assignee = item.assigned_user?.full_name ?? item.assigned_name ?? "";
          const fechaEjec = item.fecha_ejecucion
            ? new Date(item.fecha_ejecucion + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
            : fechaStr;

          return (
            <div key={item.id} className="ot-page">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <tbody>
                  {/* ── Row 1: Logo | ORDEN DE TRABAJO | N° OT ── */}
                  <tr>
                    <td rowSpan={2} style={{ border: "1.5px solid #222", width: 52, padding: 6, verticalAlign: "middle", textAlign: "center" }}>
                      {/* Logo placeholder — replace src with /logo.png */}
                      <img src="/logo.png" alt="Logo" style={{ width: 40, height: 40, objectFit: "contain" }} />
                    </td>
                    <td style={{ border: "1.5px solid #222", padding: "8px 12px", textAlign: "center" }}>
                      <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>ORDEN DE TRABAJO</span>
                    </td>
                    <td style={{ border: "1.5px solid #222", width: 48, padding: "4px 8px", textAlign: "center", fontWeight: 700, fontSize: 10, verticalAlign: "bottom" }}>
                      N° OT
                    </td>
                    <td style={{ border: "1.5px solid #222", width: 56, padding: "4px 8px", textAlign: "center", fontWeight: 900, fontSize: 14, verticalAlign: "middle" }}>
                      {item.ot_number}
                    </td>
                  </tr>

                  {/* ── Row 2: ESPECIALIDAD | value | FECHA | value ── */}
                  <tr>
                    <td style={{ border: "1.5px solid #222", padding: "5px 12px" }}>
                      <span style={{ fontWeight: 700, marginRight: 8 }}>ESPECIALIDAD</span>
                      <span>{item.especialidad ?? "—"}</span>
                      <span style={{ fontWeight: 700, marginLeft: 20, marginRight: 8 }}>FECHA</span>
                      <span>{fechaStr}</span>
                    </td>
                    <td colSpan={2} style={{ border: "1.5px solid #222", padding: "5px 8px", textAlign: "center" }}>
                      {fechaEjec}
                    </td>
                  </tr>

                  {/* ── Row 3: SECTOR | value | EQUIPO | value ── */}
                  <tr>
                    <td style={{ border: "1.5px solid #222", padding: "5px 8px", fontWeight: 700, width: 52, textAlign: "center" }}>
                      SECTOR
                    </td>
                    <td style={{ border: "1.5px solid #222", padding: "5px 12px" }}>
                      {item.sector_raw ?? "—"}
                    </td>
                    <td style={{ border: "1.5px solid #222", padding: "5px 8px", fontWeight: 700, textAlign: "center" }} colSpan={1}>
                      EQUIPO
                    </td>
                    <td style={{ border: "1.5px solid #222", padding: "5px 8px" }}>
                      {item.equipo_raw ?? "—"}
                    </td>
                  </tr>

                  {/* ── Row 4: DESCRIPCIÓN ── */}
                  <tr>
                    <td style={{ border: "1.5px solid #222", padding: "6px 8px", fontWeight: 700, textAlign: "center", verticalAlign: "top" }}>
                      DESCRIPCIÓN
                    </td>
                    <td colSpan={3} style={{ border: "1.5px solid #222", padding: "8px 12px", height: 140, verticalAlign: "top" }}>
                      <div style={{ fontSize: 11, lineHeight: 1.5 }}>{item.descripcion ?? ""}</div>
                      {item.notas_item && (
                        <div style={{ marginTop: 8, fontSize: 10, color: "#555", fontStyle: "italic", borderTop: "1px dashed #ccc", paddingTop: 6 }}>
                          Nota: {item.notas_item}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* ── Row 5: REPUESTOS ── */}
                  <tr>
                    <td style={{ border: "1.5px solid #222", padding: "6px 8px", fontWeight: 700, textAlign: "center", verticalAlign: "top", fontSize: 10 }}>
                      REPUESTOS<br />UTILIZADOS
                    </td>
                    <td colSpan={3} style={{ border: "1.5px solid #222", padding: "8px 12px", height: 90, verticalAlign: "top" }}>
                      {item.repuesto ?? ""}
                    </td>
                  </tr>

                  {/* ── Row 6: FECHA EJECUCIÓN | REALIZADO/ATRASADO | FIRMA ── */}
                  <tr>
                    <td style={{ border: "1.5px solid #222", padding: "6px 8px", fontWeight: 700, textAlign: "center", fontSize: 9, verticalAlign: "middle" }}>
                      FECHA DE<br />EJECUCIÓN
                    </td>
                    <td style={{ border: "1.5px solid #222", padding: "6px 12px", verticalAlign: "middle" }}>
                      {fechaEjec}
                    </td>
                    <td style={{ border: "1.5px solid #222", padding: "6px 8px", textAlign: "center", fontWeight: 700, fontSize: 10, verticalAlign: "middle" }}>
                      REALIZADO / ATRASADO
                    </td>
                    <td style={{ border: "1.5px solid #222", padding: "6px 8px", verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 2 }}>FIRMA</div>
                      {assignee && (
                        <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{assignee}</div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </>
  );
}
