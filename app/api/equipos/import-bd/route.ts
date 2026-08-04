import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";

const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v) || null);
const intOrNull = (v: any) => (v === "" || v == null ? null : parseInt(v, 10) || null);
const txtOrNull = (v: any) => { const s = (v ?? "").toString().trim(); return s || null; };
function excelDateToISO(v: any): string | null {
  if (!v) return null;
  const n = Number(v);
  if (!isNaN(n) && n > 1) return new Date((n - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data: caller } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!["admin_sistema", "administrador"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });

  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
  const sheet = (name: string) =>
    wb.Sheets[name] ? XLSX.utils.sheet_to_json<any>(wb.Sheets[name], { defval: "" }) : [];

  const admin = createAdminClient();
  const result = { tipos: 0, equipos: 0, componentes: 0, no_encontrados: [] as string[] };

  // ── 1) TIPO_EQUIPO → equipment_types ──────────────────────────────────────
  const tipos = sheet("TIPO_EQUIPO").filter((r) => r.tipo_id);
  const tipoNombre = new Map<string, string>();
  if (tipos.length) {
    const rows = tipos.map((t) => {
      const rec: any = {};
      for (const k of Object.keys(t)) rec[k] = txtOrNull(t[k]);
      rec.tipo_id = (t.tipo_id ?? "").toString().trim();
      tipoNombre.set(rec.tipo_id, t.nombre_tipo ?? "");
      return rec;
    });
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from("equipment_types").upsert(rows.slice(i, i + 200), { onConflict: "tipo_id" });
      if (error) return NextResponse.json({ error: `Tipos: ${error.message}` }, { status: 500 });
    }
    result.tipos = rows.length;
  }

  // Mapa código → id de los equipos existentes en la app
  const { data: eqList } = await admin.from("equipment").select("id, code");
  const codeToId = new Map<string, string>((eqList ?? []).map((e: any) => [e.code, e.id]));

  // ── 2) EQUIPOS → ficha de cada equipo (solo campos no vacíos) ──────────────
  for (const r of sheet("EQUIPOS").filter((x) => x.equipo_id)) {
    const code = (r.equipo_id ?? "").toString().trim();
    const id = codeToId.get(code);
    if (!id) { result.no_encontrados.push(code); continue; }

    const p: any = {};
    const setT = (k: string, v: any) => { const x = txtOrNull(v); if (x != null) p[k] = x; };
    const setN = (k: string, v: any) => { const x = numOrNull(v); if (x != null) p[k] = x; };
    const setI = (k: string, v: any) => { const x = intOrNull(v); if (x != null) p[k] = x; };

    if (r.tipo_id) { p.tipo_id = (r.tipo_id ?? "").toString().trim(); p.tipo_equipo = tipoNombre.get(p.tipo_id) ?? null; }
    setT("descripcion_proceso", r.descripcion_proceso);
    setN("power_kw", r.potencia_kw);
    setT("marca", r.marca); setT("modelo", r.modelo); setT("nro_serie", r.nro_serie);
    setI("anio_fabricacion", r["año_fabricacion"]); setI("anio_instalacion", r["año_instalacion"]);
    setT("tension_v", r.tension_v); setN("intensidad_nominal_a", r.intensidad_nominal_a);
    setI("rpm_motor", r.rpm_motor); setN("fp_cos_phi", r.fp_cos_phi);
    setT("relacion_reduccion", r.relacion_reduccion_real); setI("rpm_salida", r.rpm_salida);
    setT("rodamiento_motor_de", r.rodamiento_motor_DE); setT("rodamiento_motor_nde", r.rodamiento_motor_NDE);
    setT("rodamiento_carga", r.rodamiento_carga); setT("rodamiento_otro", r.rodamiento_otro);
    setT("ubicacion_fisica", r.ubicacion_fisica); setN("nivel_altura_m", r.nivel_altura_m);
    setT("origen_equipo", r.origen_equipo); setN("horas_marcha", r.horas_marcha_uso);
    setT("proveedor_repuesto_critico", r.proveedor_repuesto_critico);
    setT("relevado_por", r.relevado_por); setT("foto_registro_url", r.foto_registro_url);
    const fr = excelDateToISO(r.fecha_ultimo_relevamiento); if (fr) p.fecha_ultimo_relevamiento = fr;

    if (Object.keys(p).length > 0) {
      const { error } = await admin.from("equipment").update(p).eq("id", id);
      if (!error) result.equipos++;
    }
  }

  // ── 3) COMPONENTES → equipment_components ─────────────────────────────────
  const comps: any[] = [];
  for (const c of sheet("COMPONENTES").filter((x) => x.equipo_id && x.nombre_componente)) {
    const id = codeToId.get((c.equipo_id ?? "").toString().trim());
    if (!id) continue;
    comps.push({
      equipment_id:      id,
      componente_id:     txtOrNull(c.componente_id),
      nombre:            (c.nombre_componente ?? "").toString().trim(),
      categoria:         txtOrNull(c.categoria_componente),
      especificacion:    txtOrNull(c.especificacion),
      material:          txtOrNull(c.material),
      cantidad:          txtOrNull(c.cantidad),
      proveedor_critico: txtOrNull(c.proveedor_critico),
      criticidad:        txtOrNull(c.criticidad_componente),
      foto_url:          txtOrNull(c.foto_url),
      fecha_relevamiento: excelDateToISO(c.fecha_relevamiento),
      relevado_por:      txtOrNull(c.relevado_por),
    });
  }
  for (let i = 0; i < comps.length; i += 300) {
    const { error } = await admin.from("equipment_components").upsert(comps.slice(i, i + 300), { onConflict: "componente_id" });
    if (!error) result.componentes += comps.slice(i, i + 300).length;
  }

  return NextResponse.json(result);
}
