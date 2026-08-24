import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sube la foto a Drive a través de un Web App de Apps Script (corre con la
// cuenta del usuario dueño de la carpeta, que sí tiene cuota). Ver el código
// del script y la configuración en MIGRACION.md.
const WEBAPP_URL = process.env.DRIVE_WEBAPP_URL ?? "";
const WEBAPP_SECRET = process.env.DRIVE_WEBAPP_SECRET ?? "";

// POST { url, name } — baja la imagen (Supabase) y la manda al Web App de Drive.
// Devuelve { link } con el enlace de Drive para escribir en la planilla.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { url, name } = await request.json();
  if (!url) return NextResponse.json({ error: "url requerida" }, { status: 400 });
  if (!WEBAPP_URL) return NextResponse.json({ error: "DRIVE_WEBAPP_URL no configurado" }, { status: 503 });

  try {
    // 1) Descargar la imagen (bucket público de Supabase)
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error(`No se pudo leer la imagen (${imgRes.status})`);
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    const dataBase64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");

    // 2) Mandarla al Web App de Apps Script (guarda en la carpeta de Drive)
    const res = await fetch(WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: WEBAPP_SECRET,
        name: name || `foto-${Date.now()}.jpg`,
        mimeType,
        dataBase64,
      }),
      redirect: "follow",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error || !j.link) {
      return NextResponse.json({ error: j.error ?? `Web App ${res.status}` }, { status: 502 });
    }
    return NextResponse.json({ link: j.link, id: j.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error al subir a Drive" }, { status: 500 });
  }
}
