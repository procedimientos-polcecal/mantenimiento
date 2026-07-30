import { NextResponse } from "next/server";
import { runWorkOrdersSync, runAvisosSync } from "@/lib/sheets-sync";

// GET /api/cron/sync — lo invoca Vercel Cron cada 30 min.
// Vercel manda Authorization: Bearer <CRON_SECRET> si la variable está seteada.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET1 ?? process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: Record<string, any> = {};
  // Se corren de forma independiente: si una falla, la otra igual se sincroniza.
  try { result.work_orders = await runWorkOrdersSync(); }
  catch (e: any) { result.work_orders_error = e.message; }
  try { result.avisos = await runAvisosSync(); }
  catch (e: any) { result.avisos_error = e.message; }

  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
}
