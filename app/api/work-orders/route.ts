import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estado       = searchParams.get("estado");
  const equipment_id = searchParams.get("equipment_id");
  const search       = searchParams.get("q");
  const page         = Number(searchParams.get("page") ?? 1);
  const limit        = 50;

  const admin = createAdminClient();
  let query = admin
    .from("work_orders")
    .select("*", { count: "exact" })
    .order("ot_number", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (estado)       query = query.eq("estado", estado);
  if (equipment_id) query = query.eq("equipment_id", equipment_id);
  if (search)       query = query.or(`descripcion.ilike.%${search}%,equipo_raw.ilike.%${search}%,sector_raw.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count });
}
