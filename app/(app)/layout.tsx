import Nav from "@/app/components/Nav";
import OfflineBar from "@/app/components/OfflineBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Nav />
      <div className="main-content">
        <OfflineBar />
        {children}
      </div>
    </div>
  );
}
