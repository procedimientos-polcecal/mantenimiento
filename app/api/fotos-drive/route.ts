import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Carpeta de Drive donde se guardan las fotos que van a la planilla.
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOTOS_FOLDER_ID || "1TiZNFlJDW1StxatJfxfOQIiZjhImvWYY";

async function getDriveToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurado");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Buffer.from(pem, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, Buffer.from(unsigned));
  const jwt = `${unsigned}.${Buffer.from(sig).toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(JSON.stringify(d));
  return d.access_token;
}

// POST { url, name } — baja la imagen de la URL (Supabase) y la sube a Drive.
// Devuelve { link } con el enlace de Drive para escribir en la planilla.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { url, name } = await request.json();
  if (!url) return NextResponse.json({ error: "url requerida" }, { status: 400 });

  try {
    // 1) Descargar la imagen (bucket público de Supabase)
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`No se pudo leer la imagen (${imgRes.status})`);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const bytes = Buffer.from(await imgRes.arrayBuffer());

    // 2) Subir a Drive (multipart/related), soportando Unidades compartidas
    const token = await getDriveToken();
    const boundary = "polcecal-" + Math.random().toString(36).slice(2);
    const metadata = { name: name || `foto-${Date.now()}.jpg`, parents: [FOLDER_ID] };
    const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`;
    const post = `\r\n--${boundary}--`;
    const body = Buffer.concat([Buffer.from(pre, "utf8"), bytes, Buffer.from(post, "utf8")]);

    const upRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body }
    );
    const up = await upRes.json();
    if (!upRes.ok) return NextResponse.json({ error: up?.error?.message ?? `Drive ${upRes.status}` }, { status: 502 });

    // 3) Permiso de lectura por enlace (best-effort; algunas orgs lo bloquean)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${up.id}/permissions?supportsAllDrives=true`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
    } catch { /* ignorar */ }

    const link = up.webViewLink || `https://drive.google.com/file/d/${up.id}/view`;
    return NextResponse.json({ link, id: up.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error al subir a Drive" }, { status: 500 });
  }
}
