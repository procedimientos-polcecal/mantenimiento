import Nav from "@/app/components/Nav";
import OfflineBar from "@/app/components/OfflineBar";
import { ConfirmProvider } from "@/app/components/ConfirmProvider";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let role: string | null = null;
  if (user) {
    const { data } = await supabase.from("app_users").select("role").eq("id", user.id).single();
    role = data?.role ?? null;
  }

  return (
    <ConfirmProvider>
      <div className="app-shell">
        <Nav role={role} />
        <div className="main-content">
          <OfflineBar />
          {children}
        </div>
      </div>
    </ConfirmProvider>
  );
}
