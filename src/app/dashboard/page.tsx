"use client";

import { useSession } from "next-auth/react";
import { PremiumAgentDashboard } from "./components/agent/premium/PremiumAgentDashboard";
import { Icon } from "@iconify/react";

export default function DashboardAgentPage() {
  const { data: session, status } = useSession();
  const isAgent = (session?.user as any)?.role === "AGENT";

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Memuat session...</p>
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="px-5 py-10">
        <div className="max-w-xl mx-auto rounded-3xl border border-white/10 bg-[#07090f] p-6 text-center">
          <Icon icon="solar:shield-warning-bold-duotone" className="text-4xl text-amber-200 mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-white">Akses dibatasi</h2>
          <p className="mt-2 text-sm text-slate-400">
            Dashboard ini khusus untuk akun dengan role <span className="text-white font-semibold">AGENT</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 overflow-x-hidden">
      <PremiumAgentDashboard />
    </div>
  );
}
