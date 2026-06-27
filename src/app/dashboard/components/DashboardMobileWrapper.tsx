"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import DashboardTopbar from "@/app/dashboard/components/topbar";
import MobileSidebar from "@/app/dashboard/components/mobile-sidebar";

export default function DashboardMobileWrapper({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <DashboardTopbar onOpenMobileSidebar={() => setMobileOpen(true)} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 sm:px-5 pb-6">
          {children}
        </div>
      </div>

      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </div>
  );
}
