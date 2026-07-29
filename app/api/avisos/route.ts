import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/avisos — listar avisos
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const urgencia = searchParams.get("urgencia");
  const search   = searchParams.get("q");
  const page     = Number(searchParams.get("page") ?? 1);
  const limit    = 50;

  const admin = createAdminClient();
  let query = admin
    .from("avisos")
    .select("*", { count: "exact" })
    .order("fecha", { ascending: false, nullsFirst: false })
    .order("oa_number", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (urgencia) query = query.ilike("urgencia", `%${urgencia}%`);
  if (search) {
    const safe = search.replace(/[,()*\\%]/g, "").trim();
    if (safe) query = query.or(`descripcion.ilike.%${safe}%,equipo_raw.ilike.%${safe}%,sector_raw.ilike.%${safe}%,oa_number.ilike.%${safe}%`);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

// POST /api/avisos — crear aviso desde la app
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const { equipment_id, sector_id, sector_raw, equipo_raw, equipo_code,
          descripcion, urgencia, quien_aviso, observaciones, reference_photos } = body;

  if (!descripcion?.trim()) {
    return NextResponse.json({ error: "La descripción es requerida" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Próximo N° OA ("A" + número). Tomamos el máximo numérico existente.
  const { data: last } = await admin
    .from("avisos").select("oa_number").ilike("oa_number", "A%")
    .order("created_at", { ascending: false }).limit(200);
  let maxN = 0;
  for (const r of last ?? []) {
    const m = (r.oa_number ?? "").match(/^A(\d+)$/i);
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
  const oa_number = `A${maxN + 1}`;

  const record = {
    oa_number,
    fecha:        new Date().toISOString().slice(0, 10),
    sector_id:    sector_id || null,
    sector_raw:   sector_raw || null,
    equipo_raw:   equipo_raw || null,
    equipo_code:  equipo_code || null,
    equipment_id: equipment_id || null,
    descripcion:  descripcion.trim(),
    urgencia:     urgencia || null,
    quien_aviso:  quien_aviso || null,
    observaciones: observaciones?.trim() || null,
    reference_photos: Array.isArray(reference_photos) && reference_photos.length ? reference_photos : null,
    app_created:  true,
    created_by:   user.id,
    synced_at:    new Date().toISOString(),
  };

  const { data: inserted, error } = await admin.from("avisos").insert(record).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: inserted, oa_number });
}
