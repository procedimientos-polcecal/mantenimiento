import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOverdueAlert } from "@/lib/email";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: overdue } = await supabase
    .from("maintenance_schedules")
    .select("*, equipment(name, code), assigned_user:assigned_to(full_name)")
    .eq("status", "active")
    .lt("next_date", today);

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ sent: false, reason: "no overdue items" });
  }

  const items = overdue.map((s: any) => ({
    code:             s.equipment?.code ?? "",
    name:             s.equipment?.name ?? "",
    maintenance_type: s.maintenance_type,
    next_date:        s.next_date,
    days_overdue:     Math.floor(
      (new Date().getTime() - new Date(s.next_date).getTime()) / 86400000
    ),
    assigned_to: s.assigned_user?.full_name,
  }));

  await sendOverdueAlert(items);

  return NextResponse.json({ sent: true, count: items.length });
}
