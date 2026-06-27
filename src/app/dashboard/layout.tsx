// app/dashboard/layout.tsx — server component
import type { ReactNode } from "react";
import { OwnerSidebar } from "@/app/dashboard/components/sidebar";
import DashboardMobileWrapper from "@/app/dashboard/components/DashboardMobileWrapper";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[#050608] text-slate-50">
      <OwnerSidebar />
      <DashboardMobileWrapper>{children}</DashboardMobileWrapper>
    </div>
  );
}
