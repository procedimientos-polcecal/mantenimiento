import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ImprimirClient from "./ImprimirClient";

export default async function ImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("daily_plans")
    .select("*, daily_plan_items(*, assigned_user:assigned_to(full_name))")
    .eq("id", id).single();

  if (!plan) notFound();
  const items = [...(plan.daily_plan_items ?? [])].sort((a: any, b: any) => a.orden - b.orden);
  return <ImprimirClient plan={plan} items={items} />;
}
