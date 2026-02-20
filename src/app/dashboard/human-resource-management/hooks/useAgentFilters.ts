import { useState, useMemo } from "react";
import { Agent, AgentFilters } from "../types/agent.types";

const s = (v?: string | null) => (v || "").toLowerCase();

export function useAgentFilters(agents: Agent[]) {
  const [filters, setFilters] = useState<AgentFilters>({
    search: "",
    status: "",
    jabatan: "",
    kota: "",
  });

  const filteredAgents = useMemo(() => {
    const term = s(filters.search).trim();

    return agents.filter((a) => {
      const matchSearch =
        !term ||
        s(a.nama_lengkap).includes(term) ||
        s(a.nama_kantor).includes(term) ||
        s(a.kota_area).includes(term) ||
        s(a.nomor_whatsapp).includes(term);

      const matchStatus =
        !filters.status || a.status_keanggotaan === filters.status;

      const matchJabatan =
        !filters.jabatan || a.jabatan === filters.jabatan;

      return matchSearch && matchStatus && matchJabatan;
    });
  }, [agents, filters]);

  return { filters, setFilters, filteredAgents };
}
