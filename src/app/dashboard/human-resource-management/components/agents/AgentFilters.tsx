// app/dashboard/hrm/components/agents/AgentFilters.tsx
"use client";

import { Icon } from "@iconify/react";
import { AgentFilters } from "../../types/agent.types";
import { PremiumSelect } from "../shared/PremiumSelect";

const STATUS_OPTIONS = [
  { value: "", label: "Semua", icon: "solar:layers-minimalistic-bold" },
  { value: "AKTIF", label: "Aktif", dot: "bg-emerald-400" },
  { value: "PENDING", label: "Pending", dot: "bg-amber-400" },
  { value: "SUSPEND", label: "Suspend", dot: "bg-rose-400" },
];

const JABATAN_OPTIONS = [
  { value: "", label: "Semua", icon: "solar:users-group-rounded-bold" },
  { value: "PRINCIPAL", label: "Principal", icon: "solar:crown-bold" },
  { value: "STOKER", label: "Stoker", icon: "solar:box-bold" },
  { value: "ADMIN", label: "Admin", icon: "solar:shield-user-bold" },
  { value: "OWNER", label: "Owner", icon: "solar:key-bold" },
  { value: "AGENT", label: "Agent", icon: "solar:user-bold" },
  { value: "TEAMLEADER", label: "Team Leader", icon: "solar:users-group-two-rounded-bold" },
];

interface AgentFiltersProps {
  filters: AgentFilters;
  onFilterChange: (filters: AgentFilters) => void;
}

export function AgentFiltersComponent({
  filters,
  onFilterChange,
}: AgentFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Search: nama, kantor, kota, WA */}
      <div className="relative flex-1 min-w-[240px]">
        <Icon
          icon="solar:magnifer-bold"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"
        />
        <input
          value={filters.search}
          onChange={(e) =>
            onFilterChange({ ...filters, search: e.target.value })
          }
          placeholder="Cari nama, kantor, kota, atau nomor WA..."
          className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50"
        />
      </div>

      {/* Status akun */}
      <PremiumSelect
        value={filters.status}
        options={STATUS_OPTIONS}
        onChange={(v) =>
          onFilterChange({ ...filters, status: v as AgentFilters["status"] })
        }
        prefix="Status:"
        minWidthClass="min-w-[160px]"
      />

      {/* Jabatan agent */}
      <PremiumSelect
        value={filters.jabatan}
        options={JABATAN_OPTIONS}
        onChange={(v) =>
          onFilterChange({ ...filters, jabatan: v as AgentFilters["jabatan"] })
        }
        prefix="Jabatan:"
        minWidthClass="min-w-[180px]"
      />
    </div>
  );
}
