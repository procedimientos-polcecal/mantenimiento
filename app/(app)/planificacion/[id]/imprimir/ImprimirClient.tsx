"use client";

import { useEffect, useRef, useState } from "react";

export default function ImprimirClient({ plan, items }: { plan: any; items: any[] }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const planDate = new Date(plan.fecha + "T12:00:00");
  const fechaStr = planDate.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  useEffect(() => {
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, []);

  async function savePDF() {
    if (!contentRef.current) return;
    setGenerating(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: [8, 10, 8, 10],
          filename: `OT_Plan_${plan.fecha}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["avoid-all", "css"], before: ".pdf-page-break" },
        })
        .from(contentRef.current)
        .save();
    } finally {
      setGenerating(false);
    }
  }

  // Group items in pairs (2 per page)
  const pages: [any, any?][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pages.push([items[i], items[i + 1]]);
  }

  return (
    <>
      {/* Controls — hidden on print */}
      <div className="no-print fixed top-4 right-4 z-10 flex gap-2">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Imprimir
        </button>
        <button onClick={savePDF} disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 shadow-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">
          {generating ? (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          )}
          {generating ? "Generando PDF..." : "Guardar PDF"}
        </button>
        <button onClick={() => window.close()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50 transition-colors">
          Cerrar
        </button>
      </div>

      <style>{`
        @page { size: A4 portrait; margin: 8mm 10mm; }
        @media print {
          .no-print { display: none !important; }
          aside, .sidebar, .mobile-topbar, nav { display: none !important; }
          main, [class*="main"], body > div { margin: 0 !important; padding: 0 !important; }
          body { background: white !important; margin: 0 !important; }
          .ot-pair { page-break-after: always; }
          .ot-pair:last-child { page-break-after: avoid; }
        }
        body { background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; }
        .ot-pair {
          width: 182mm; margin: 0 auto 12mm;
          background: white; border: 1px solid #ddd;
          display: flex; flex-direction: column; gap: 6mm;
          padding: 4mm;
        }
        @media print {
          .ot-pair { width: 100%; margin: 0; border: none; padding: 0; gap: 5mm; }
        }
      `}</style>

      <div className="py-6 px-4" ref={contentRef}>
        {pages.map((pair, pageIdx) => (
          <div key={pageIdx} className={`ot-pair${pageIdx > 0 ? " pdf-page-break" : ""}`}>
            {pair.map((item, i) => item ? (
              <OTTable key={item.id} item={item} fechaStr={fechaStr} divider={i === 0 && pair[1] != null} />
            ) : null)}
          </div>
        ))}
      </div>
    </>
  );
}

function OTTable({ item, fechaStr, divider }: { item: any; fechaStr: string; divider: boolean }) {
  const assignee = item.assigned_user?.full_name ?? item.assigned_name ?? "";
  const fechaEjec = item.fecha_ejecucion
    ? new Date(item.fecha_ejecucion + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : fechaStr;

  return (
    <div style={{ borderBottom: divider ? "2px dashed #ccc" : "none", paddingBottom: divider ? "5mm" : 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <tbody>
          {/* Row 1: Logo | ORDEN DE TRABAJO | N° OT */}
          <tr>
            <td rowSpan={2} style={{ border: "1.5px solid #222", width: 46, padding: 4, verticalAlign: "middle", textAlign: "center" }}>
              <img src="/logo.png" alt="Logo" style={{ width: 34, height: 34, objectFit: "contain" }} />
            </td>
            <td style={{ border: "1.5px solid #222", padding: "5px 10px", textAlign: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1 }}>ORDEN DE TRABAJO</span>
            </td>
            <td style={{ border: "1.5px solid #222", width: 44, padding: "3px 6px", textAlign: "center", fontWeight: 700, fontSize: 9, verticalAlign: "bottom" }}>
              N° OT
            </td>
            <td style={{ border: "1.5px solid #222", width: 52, padding: "3px 6px", textAlign: "center", fontWeight: 900, fontSize: 13, verticalAlign: "middle" }}>
              {item.ot_number}
            </td>
          </tr>

          {/* Row 2: ESPECIALIDAD | FECHA */}
          <tr>
            <td style={{ border: "1.5px solid #222", padding: "4px 10px" }}>
              <span style={{ fontWeight: 700, marginRight: 6, fontSize: 9 }}>ESPECIALIDAD</span>
              <span style={{ fontSize: 10 }}>{item.especialidad ?? "—"}</span>
              <span style={{ fontWeight: 700, marginLeft: 16, marginRight: 6, fontSize: 9 }}>FECHA</span>
              <span style={{ fontSize: 10 }}>{fechaStr}</span>
            </td>
            <td colSpan={2} style={{ border: "1.5px solid #222", padding: "4px 6px", textAlign: "center", fontSize: 10 }}>
              {fechaEjec}
            </td>
          </tr>

          {/* Row 3: SECTOR | EQUIPO */}
          <tr>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", fontWeight: 700, fontSize: 9, width: 46, textAlign: "center" }}>
              SECTOR
            </td>
            <td style={{ border: "1.5px solid #222", padding: "4px 10px", fontSize: 10 }}>
              {item.sector_raw ?? "—"}
            </td>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", fontWeight: 700, fontSize: 9, textAlign: "center" }}>
              EQUIPO
            </td>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", fontSize: 10 }}>
              {item.equipo_raw ?? "—"}
            </td>
          </tr>

          {/* Row 4: DESCRIPCIÓN */}
          <tr>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", fontWeight: 700, fontSize: 9, textAlign: "center", verticalAlign: "top" }}>
              DESCRIPCIÓN
            </td>
            <td colSpan={3} style={{ border: "1.5px solid #222", padding: "6px 10px", height: 70, verticalAlign: "top" }}>
              <div style={{ fontSize: 10, lineHeight: 1.4 }}>{item.descripcion ?? ""}</div>
              {item.notas_item && (
                <div style={{ marginTop: 5, fontSize: 9, color: "#555", fontStyle: "italic", borderTop: "1px dashed #ccc", paddingTop: 4 }}>
                  Nota: {item.notas_item}
                </div>
              )}
            </td>
          </tr>

          {/* Row 5: REPUESTOS */}
          <tr>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", fontWeight: 700, fontSize: 9, textAlign: "center", verticalAlign: "top" }}>
              REPUESTOS<br />UTILIZADOS
            </td>
            <td colSpan={3} style={{ border: "1.5px solid #222", padding: "6px 10px", height: 50, verticalAlign: "top", fontSize: 10 }}>
              {item.repuesto ?? ""}
            </td>
          </tr>

          {/* Row 6: FECHA EJECUCIÓN | REALIZADO/ATRASADO | FIRMA */}
          <tr>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", fontWeight: 700, textAlign: "center", fontSize: 8, verticalAlign: "middle" }}>
              FECHA DE<br />EJECUCIÓN
            </td>
            <td style={{ border: "1.5px solid #222", padding: "4px 10px", verticalAlign: "middle", fontSize: 10 }}>
              {fechaEjec}
            </td>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", textAlign: "center", fontWeight: 700, fontSize: 9, verticalAlign: "middle" }}>
              REALIZADO /<br />ATRASADO
            </td>
            <td style={{ border: "1.5px solid #222", padding: "4px 6px", verticalAlign: "middle" }}>
              <div style={{ fontWeight: 700, fontSize: 9 }}>FIRMA</div>
              {assignee && <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>{assignee}</div>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
