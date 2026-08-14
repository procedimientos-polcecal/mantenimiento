import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { osNorm } from "@/lib/sheets-sync";

const SHEET_ID = process.env.GOOGLE_SHEETS_INVENTARIO_ID ?? "";
const TAB      = process.env.GOOGLE_SHEETS_INVENTARIO_TAB ?? "";

// Alias de encabezados del inventario → clave interna (el primero que matchee gana)
const ALIASES: Record<string, string[]> = {
  codigo:      ["CODIGO", "COD", "SKU", "ARTICULO", "ART", "ITEM", "N ITEM", "N ARTICULO"],
  descripcion: ["DESCRIPCION", "NOMBRE", "DETALLE", "REPUESTO", "PRODUCTO", "ARTICULO"],
  stock:       ["STOCK ACTUAL", "STOCK", "CANTIDAD", "CANT", "EXISTENCIA", "DISPONIBLE", "SALDO", "EN STOCK"],
  seguridad:   ["STOCK DE SEGURIDAD", "STOCK SEGURIDAD", "STOCK MINIMO", "MINIMO", "SS"],
  ubicacion:   ["UBICACION", "DEPOSITO", "ESTANTE", "LUGAR", "POSICION", "PAÑOL"],
};

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurado");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
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

type Item = { codigo: string; descripcion: string; stock: number | null; stockRaw: string; seguridad: number | null; ubicacion: string };

// Lee el inventario en vivo desde la planilla
async function readInventory(): Promise<Item[]> {
  if (!SHEET_ID) throw new Error("GOOGLE_SHEETS_INVENTARIO_ID no configurado");
  const token = await getAccessToken();
  const range = TAB ? `${encodeURIComponent(TAB)}` : "A:Z";
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Inventario Sheets ${res.status}: ${await res.text()}`);
  const rows: string[][] = (await res.json()).values ?? [];
  if (rows.length < 2) return [];

  const header = rows[0].map(osNorm);
  const colOf = (key: string) => {
    for (const a of ALIASES[key]) { const i = header.indexOf(osNorm(a)); if (i >= 0) return i; }
    return -1;
  };
  const idx = { codigo: colOf("codigo"), descripcion: colOf("descripcion"), stock: colOf("stock"), seguridad: colOf("seguridad"), ubicacion: colOf("ubicacion") };
  const numAt = (row: string[], i: number) => {
    if (i < 0) return null;
    const raw = (row[i] ?? "").toString().trim();
    if (raw === "") return null;
    const n = Number(raw.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  };

  const items: Item[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const codigo = idx.codigo >= 0 ? (row[idx.codigo] ?? "").toString().trim() : "";
    const descripcion = idx.descripcion >= 0 ? (row[idx.descripcion] ?? "").toString().trim() : "";
    if (!codigo && !descripcion) continue;
    items.push({
      codigo, descripcion,
      stock: numAt(row, idx.stock),
      stockRaw: idx.stock >= 0 ? (row[idx.stock] ?? "").toString().trim() : "",
      seguridad: numAt(row, idx.seguridad),
      ubicacion: idx.ubicacion >= 0 ? (row[idx.ubicacion] ?? "").toString().trim() : "",
    });
  }
  return items;
}

// GET ?q=texto  → búsqueda para autocompletar (por código o nombre)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!SHEET_ID) return NextResponse.json({ error: "Inventario no configurado", data: [] }, { status: 200 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().toLowerCase();
  try {
    const inv = await readInventory();
    const filtered = q
      ? inv.filter((i) => i.codigo.toLowerCase().includes(q) || i.descripcion.toLowerCase().includes(q)).slice(0, 30)
      : inv.slice(0, 30);
    return NextResponse.json({ data: filtered });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 200 });
  }
}

// POST { items: [{codigo, nombre}] } → disponibilidad de cada uno
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { items } = await request.json();
  if (!Array.isArray(items)) return NextResponse.json({ error: "items requerido" }, { status: 400 });

  if (!SHEET_ID) {
    return NextResponse.json({ configured: false, results: items.map((it: any) => ({ ...it, match: null })) });
  }

  try {
    const inv = await readInventory();
    const byCode = new Map<string, Item>();
    const byName = new Map<string, Item>();
    for (const it of inv) {
      if (it.codigo) byCode.set(it.codigo.toLowerCase(), it);
      if (it.descripcion) byName.set(it.descripcion.toLowerCase(), it);
    }
    const results = items.map((it: any) => {
      const code = (it.codigo ?? "").toString().trim().toLowerCase();
      const name = (it.nombre ?? "").toString().trim().toLowerCase();
      let match: Item | null = null;
      if (code && byCode.has(code)) match = byCode.get(code)!;
      else if (name && byName.has(name)) match = byName.get(name)!;
      else if (name) match = inv.find((i) => i.descripcion.toLowerCase().includes(name)) ?? null; // parcial
      const disponible = match ? (match.stock == null ? null : match.stock > 0) : false;
      const bajoMinimo = !!(match && match.stock != null && match.seguridad != null && match.stock <= match.seguridad);
      return { ...it, match, disponible, bajoMinimo };
    });
    return NextResponse.json({ configured: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, configured: true, results: [] }, { status: 200 });
  }
}
