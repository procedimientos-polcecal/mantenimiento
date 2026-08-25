/**
 * Webhook onEdit para la planilla de AVISOS.
 * Al editar una fila, avisa a la app para sincronizar ese aviso al instante.
 *
 * ── Cómo instalarlo ───────────────────────────────────────────────────────
 * 1. En la planilla de Avisos: Extensiones → Apps Script.
 * 2. Pegá este código. Cambiá WEBHOOK_URL y WEBHOOK_SECRET (ver abajo).
 * 3. Activadores (reloj, izquierda) → Agregar activador:
 *      - Función: onEditAvisos
 *      - Evento: Al editar (desde la hoja de cálculo)
 *    Guardar → Autorizar permisos.
 *
 * WEBHOOK_URL    = https://DOMINIO-DEL-ERP/api/avisos/webhook
 * WEBHOOK_SECRET = el mismo valor que la env AVISOS_WEBHOOK_SECRET en Vercel.
 * ──────────────────────────────────────────────────────────────────────────
 */

const WEBHOOK_URL    = 'https://DOMINIO-DEL-ERP/api/avisos/webhook';
const WEBHOOK_SECRET = 'PEGAR_AVISOS_WEBHOOK_SECRET';
const TAB            = 'AVISOS';   // nombre exacto de la pestaña
const NUM_COLS       = 11;         // columnas A..K (N° OA .. Observaciones)

function onEditAvisos(e) {
  try {
    const sh = e.range.getSheet();
    if (sh.getName() !== TAB) return;
    const row = e.range.getRow();
    if (row < 2) return; // fila de encabezado

    // Valores tal como se ven (strings); la app tolera fecha en d/m/aaaa.
    const data = sh.getRange(row, 1, 1, NUM_COLS).getDisplayValues()[0];
    if (!(data[0] || '').toString().trim()) return; // sin N° OA → ignorar

    UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-webhook-secret': WEBHOOK_SECRET },
      payload: JSON.stringify({ row: row, data: data }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error('onEditAvisos', err);
  }
}
