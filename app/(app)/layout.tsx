import Nav from "@/app/components/Nav";
import OfflineBar from "@/app/components/OfflineBar";
import { ConfirmProvider } from "@/app/components/ConfirmProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <div className="app-shell">
        <Nav />
        <div className="main-content">
          <OfflineBar />
          {children}
        </div>
      </div>
    </ConfirmProvider>
  );
}
