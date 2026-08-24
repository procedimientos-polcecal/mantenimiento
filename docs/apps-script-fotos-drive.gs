/**
 * Web App de Apps Script para guardar las fotos de OT en Google Drive.
 *
 * Corre con TU cuenta (dueña de la carpeta), así que sí tiene cuota de Drive
 * — a diferencia de la cuenta de servicio. La app (endpoint /api/fotos-drive)
 * le manda la imagen y este script la guarda en la carpeta y devuelve el link.
 *
 * ── Cómo desplegarlo ──────────────────────────────────────────────────────
 * 1. Entrá a https://script.google.com  → Nuevo proyecto.
 * 2. Pegá este código completo (reemplaza lo que haya).
 * 3. Cambiá SECRET por tu secreto (el mismo que pondrás en Vercel como
 *    DRIVE_WEBAPP_SECRET) y verificá FOLDER_ID.
 * 4. Implementar → Nueva implementación → tipo "Aplicación web":
 *      - Ejecutar como:  Yo (tu cuenta)
 *      - Quién tiene acceso:  Cualquier persona
 *    Implementar → Autorizar permisos (aceptá los de Drive).
 * 5. Copiá la "URL de la aplicación web" (termina en /exec) → va en Vercel
 *    como DRIVE_WEBAPP_URL.
 * ──────────────────────────────────────────────────────────────────────────
 */

const SECRET = 'PONER_EL_MISMO_SECRETO_QUE_EN_VERCEL';
const FOLDER_ID = '1TiZNFlJDW1StxatJfxfOQIiZjhImvWYY';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json({ error: 'unauthorized' });

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const bytes = Utilities.base64Decode(body.dataBase64);
    const blob = Utilities.newBlob(bytes, body.mimeType || 'image/jpeg', body.name || ('foto-' + Date.now() + '.jpg'));
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json({ link: file.getUrl(), id: file.getId() });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
