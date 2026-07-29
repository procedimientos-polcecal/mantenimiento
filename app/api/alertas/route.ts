import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOverdueAlert } from "@/lib/email";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // OTs atrasadas (estado ATRASADO o con próxima fecha vencida y sin realizar)
  const { data: overdue } = await supabase
    .from("work_orders")
    .select("ot_number, descripcion, equipo_raw, equipo_code, sector_raw, estado, proxima_fecha, quien")
    .or(`estado.eq.ATRASADO,and(proxima_fecha.lt.${today},estado.neq.REALIZADO)`)
    .limit(200);

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ sent: false, reason: "no overdue items" });
  }

  const items = overdue.map((o: any) => ({
    code:             o.equipo_code ?? "",
    name:             o.equipo_raw ?? o.descripcion ?? "",
    maintenance_type: `OT #${o.ot_number}`,
    next_date:        o.proxima_fecha ?? "—",
    days_overdue:     o.proxima_fecha
      ? Math.max(0, Math.floor((Date.now() - new Date(o.proxima_fecha).getTime()) / 86400000))
      : 0,
    assigned_to: o.quien ?? undefined,
  }));

  await sendOverdueAlert(items);

  return NextResponse.json({ sent: true, count: items.length });
}
