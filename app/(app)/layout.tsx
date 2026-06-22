import Nav from "@/app/components/Nav";
import OfflineBar from "@/app/components/OfflineBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <OfflineBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
