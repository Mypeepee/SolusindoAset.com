"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  Crown,
  GitBranch,
  Save,
  Search,
  ShieldCheck,
  User2,
  Users,
} from "lucide-react";

type Agent = {
  id_agent: string;
  nama?: string | null;
  kantor?: string | null;
  jabatan?: string | null;
};

type AgentRelation = {
  id_agent: string;
  nama: string;
  kantor: string | null;
  jabatan?: string | null;
};

type AgentRelationsResponse = {
  agents: AgentRelation[];
  selectedAgent: AgentRelation | null;
  upline: AgentRelation | null;
  teamLeader: AgentRelation | null;
  downlines: AgentRelation[];
  teamLeaderOptions: AgentRelation[];
};

type PersistedSelection = {
  selectedAgentId: string;
  selectedLeaderId: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getInitials(name?: string | null) {
  if (!name) return "--";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function GlassCard({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[30px]",
        "bg-[linear-gradient(180deg,rgba(17,22,21,0.97),rgba(8,11,10,0.99))]",
        "shadow-[0_24px_90px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.04)]",
        "backdrop-blur-2xl",
        glow &&
          "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_34%)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      {children}
    </div>
  );
}

function HeroCard({
  title,
  subtitle,
  icon,
  tone = "emerald",
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone?: "emerald" | "slate";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] p-5 sm:p-6",
        "shadow-[0_24px_70px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.04)]",
        tone === "emerald"
          ? "bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.03)_38%,rgba(10,13,12,0.98)_100%)]"
          : "bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02)_34%,rgba(10,13,12,0.98)_100%)]"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl",
          tone === "emerald" ? "bg-emerald-400/12" : "bg-white/8"
        )}
      />
      <div className="relative">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-[20px]",
              tone === "emerald"
                ? "bg-emerald-400/12 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.14)]"
                : "bg-white/[0.06] text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
            )}
          >
            {icon}
          </div>

          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
              {title}
            </h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/50">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  emerald = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  emerald?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          emerald
            ? "bg-emerald-400/12 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
            : "bg-white/[0.05] text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        )}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-white sm:text-base">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-1 text-xs leading-5 text-white/45">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-4",
        accent
          ? "bg-emerald-400/[0.08] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
          : "bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
      )}
    >
      <div className="flex items-center gap-2 text-white/45">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "mt-3 text-base font-semibold tracking-[-0.02em]",
          accent ? "text-emerald-300" : "text-white"
        )}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] px-4 py-10 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="text-sm font-medium text-white/72">{title}</div>
      <div className="mt-1 text-xs text-white/40">{subtitle}</div>
    </div>
  );
}

function RelationCard({
  title,
  subtitle,
  person,
  icon,
  accent = false,
}: {
  title: string;
  subtitle: string;
  person: AgentRelation | null;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <GlassCard
      glow={accent}
      className={cn(
        "overflow-hidden p-5",
        accent &&
          "bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.03)_34%,rgba(9,12,11,0.99)_100%)]"
      )}
    >
      <SectionHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        emerald={accent}
      />

      {person ? (
        <div className="mt-5 flex items-start gap-4">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
              accent
                ? "bg-emerald-400/12 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
                : "bg-white/[0.05] text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
            )}
          >
            {getInitials(person.nama)}
          </div>

          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "truncate text-base font-semibold tracking-[-0.02em]",
                accent ? "text-emerald-300" : "text-white"
              )}
            >
              {person.nama}
            </div>
            <div className="mt-1 text-sm text-white/45">{person.id_agent}</div>

            <div className="mt-4 grid gap-2">
              <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <span className="text-white/40">Kantor:</span> {person.kantor ?? "-"}
              </div>
              <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <span className="text-white/40">Jabatan:</span> {person.jabatan ?? "-"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-white/[0.03] px-4 py-8 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="text-sm font-medium text-white/72">Belum ada data</div>
          <div className="mt-1 text-xs text-white/40">
            Informasi belum tersedia.
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function DownlineCard({ item }: { item: AgentRelation }) {
  return (
    <div className="rounded-[24px] bg-white/[0.04] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition duration-200 hover:bg-emerald-400/[0.06] hover:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.10)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-xs font-semibold text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.10)]">
          {getInitials(item.nama)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{item.nama}</div>
          <div className="mt-1 text-xs text-white/40">{item.id_agent}</div>
        </div>

        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.10)]">
          Agent
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-black/15 px-3 py-2 text-sm text-white/70">
        <span className="text-white/35">Kantor:</span> {item.kantor ?? "-"}
      </div>
    </div>
  );
}

function CommandDropdown({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  onSelect,
  disabled = false,
  accent = false,
}: {
  label: string;
  value: AgentRelation | null;
  options: AgentRelation[];
  placeholder: string;
  searchPlaceholder: string;
  onSelect: (item: AgentRelation) => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return options;

    return options.filter((item) => {
      return (
        item.nama.toLowerCase().includes(q) ||
        item.id_agent.toLowerCase().includes(q) ||
        (item.kantor ?? "").toLowerCase().includes(q)
      );
    });
  }, [keyword, options]);

  return (
    <div ref={wrapperRef} className={cn("relative", open && "z-[200]")}>
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(
          "flex h-14 w-full items-center justify-between rounded-[22px] px-4 text-left transition",
          "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]",
          disabled
            ? "cursor-not-allowed bg-white/[0.03] text-white/30"
            : accent
            ? "bg-emerald-400/[0.08] text-white hover:bg-emerald-400/[0.10]"
            : "bg-white/[0.05] text-white hover:bg-white/[0.065]"
        )}
      >
        <div className="min-w-0">
          {value ? (
            <>
              <div className="truncate text-sm font-medium text-white">
                {value.nama}
              </div>
              <div className="truncate text-xs text-white/45">
                {value.id_agent}
                {value.kantor ? ` • ${value.kantor}` : ""}
              </div>
            </>
          ) : (
            <div className="text-sm text-white/45">{placeholder}</div>
          )}
        </div>

        <ChevronDown
          className={cn(
            "ml-3 h-4 w-4 shrink-0 text-white/40 transition",
            open && "rotate-180"
          )}
        />
      </button>

      {open && !disabled ? (
        <div className="absolute left-0 top-full z-[300] mt-3 w-full overflow-hidden rounded-[24px] bg-[#0d1211] shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="border-b border-white/5 p-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <Search className="h-4 w-4 text-white/35" />
              <input
                autoFocus
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filteredOptions.length > 0 ? (
              <div className="space-y-1">
                {filteredOptions.map((item) => {
                  const selected = value?.id_agent === item.id_agent;

                  return (
                    <button
                      key={item.id_agent}
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        setOpen(false);
                        setKeyword("");
                      }}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition",
                        selected
                          ? "bg-emerald-400/[0.10] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]"
                          : "hover:bg-white/[0.04]"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {item.nama}
                        </div>
                        <div className="mt-1 truncate text-xs text-white/40">
                          {item.id_agent}
                          {item.kantor ? ` • ${item.kantor}` : ""}
                        </div>
                      </div>

                      {selected ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-8 text-center">
                <div className="text-sm font-medium text-white/70">
                  Tidak ada hasil
                </div>
                <div className="mt-1 text-xs text-white/40">
                  Coba gunakan kata kunci lain.
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function TabAgent({
  agent,
}: {
  agent: Agent | null;
}) {
  const [data, setData] = useState<AgentRelationsResponse>({
    agents: [],
    selectedAgent: null,
    upline: null,
    teamLeader: null,
    downlines: [],
    teamLeaderOptions: [],
  });

  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialAgentId = useMemo(() => agent?.id_agent ?? "", [agent]);
  const storageKey = useMemo(
    () => (initialAgentId ? `tab-agent-selection:${initialAgentId}` : ""),
    [initialAgentId]
  );

  const hasHydratedRef = useRef(false);

  function readPersistedSelection(): PersistedSelection | null {
    if (typeof window === "undefined" || !storageKey) return null;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<PersistedSelection>;

      return {
        selectedAgentId: parsed.selectedAgentId ?? "",
        selectedLeaderId: parsed.selectedLeaderId ?? "",
      };
    } catch (error) {
      console.error("Gagal membaca localStorage tab agent:", error);
      return null;
    }
  }

  function persistSelection(agentId: string, leaderId: string) {
    if (typeof window === "undefined" || !storageKey) return;

    try {
      const payload: PersistedSelection = {
        selectedAgentId: agentId ?? "",
        selectedLeaderId: leaderId ?? "",
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.error("Gagal menyimpan localStorage tab agent:", error);
    }
  }

  const selectedAgentObject = useMemo(() => {
    return (
      data.agents.find((item) => item.id_agent === selectedAgentId) ??
      data.selectedAgent ??
      null
    );
  }, [data.agents, data.selectedAgent, selectedAgentId]);

  const selectedLeaderObject = useMemo(() => {
    if (selectedLeaderId) {
      return (
        data.teamLeaderOptions.find((item) => item.id_agent === selectedLeaderId) ??
        (data.teamLeader?.id_agent === selectedLeaderId ? data.teamLeader : null)
      );
    }

    return data.teamLeader ?? null;
  }, [data.teamLeader, data.teamLeaderOptions, selectedLeaderId]);

  async function fetchAgentRelations(
    agentId?: string,
    preferredLeaderId?: string
  ) {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    const res = await fetch(`/api/closing/listing/${initialAgentId}/agent${query}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Gagal mengambil data relasi agent");
    }

    const json = (await res.json()) as Partial<AgentRelationsResponse>;

    const nextData: AgentRelationsResponse = {
      agents: Array.isArray(json.agents) ? json.agents : [],
      selectedAgent: json.selectedAgent ?? null,
      upline: json.upline ?? null,
      teamLeader: json.teamLeader ?? null,
      downlines: Array.isArray(json.downlines) ? json.downlines : [],
      teamLeaderOptions: Array.isArray(json.teamLeaderOptions)
        ? json.teamLeaderOptions
        : [],
    };

    setData(nextData);

    const resolvedAgentId =
      agentId ||
      nextData.selectedAgent?.id_agent ||
      initialAgentId ||
      nextData.agents[0]?.id_agent ||
      "";

    const preferredLeaderStillExists =
      !!preferredLeaderId &&
      nextData.teamLeaderOptions.some(
        (item) => item.id_agent === preferredLeaderId
      );

    const resolvedLeaderId = preferredLeaderStillExists
      ? preferredLeaderId
      : nextData.teamLeader?.id_agent ?? "";

    setSelectedAgentId(resolvedAgentId);
    setSelectedLeaderId(resolvedLeaderId);

    persistSelection(resolvedAgentId, resolvedLeaderId);
  }

  useEffect(() => {
    if (!initialAgentId) {
      setData({
        agents: [],
        selectedAgent: null,
        upline: null,
        teamLeader: null,
        downlines: [],
        teamLeaderOptions: [],
      });
      setSelectedAgentId("");
      setSelectedLeaderId("");
      hasHydratedRef.current = true;
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        setLoading(true);

        const persisted = readPersistedSelection();
        const agentIdToLoad = persisted?.selectedAgentId || initialAgentId;
        const leaderIdToKeep = persisted?.selectedLeaderId || "";

        if (!cancelled) {
          await fetchAgentRelations(agentIdToLoad, leaderIdToKeep);
          hasHydratedRef.current = true;
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [initialAgentId]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    persistSelection(selectedAgentId, selectedLeaderId);
  }, [selectedAgentId, selectedLeaderId, storageKey]);

  async function handleChangeAgent(nextAgentId: string) {
    setSelectedAgentId(nextAgentId);
    setSelectedLeaderId("");
    persistSelection(nextAgentId, "");

    if (!nextAgentId) {
      setData((prev) => ({
        ...prev,
        selectedAgent: null,
        upline: null,
        teamLeader: null,
        downlines: [],
      }));
      return;
    }

    try {
      setLoading(true);
      await fetchAgentRelations(nextAgentId, "");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveLeader() {
    if (!selectedAgentId || !selectedLeaderId) return;

    try {
      setSaving(true);

      const res = await fetch(`/api/closing/listing/${initialAgentId}/agent`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: selectedAgentId,
          teamLeaderId: selectedLeaderId,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal menyimpan team leader");
      }

      persistSelection(selectedAgentId, selectedLeaderId);
      await fetchAgentRelations(selectedAgentId, selectedLeaderId);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const displayedLeader = selectedLeaderObject;

  return (
    <div className="space-y-4 sm:space-y-5">
      <GlassCard glow className="relative z-40 overflow-visible p-4 sm:p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.10)]">
              <ShieldCheck size={13} />
              Agent Structure
            </div>

            <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em] text-white sm:text-[22px]">
              Struktur agent closing
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/45">
              Pilih agent, lihat relasinya, lalu tentukan team leader dengan
              tampilan yang lebih professional dan nyaman di semua layar.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[620px]">
            <CommandDropdown
              label="Pilih Agent"
              value={selectedAgentObject}
              options={data.agents}
              placeholder="Pilih agent closing"
              searchPlaceholder="Cari nama agent, ID, kantor..."
              onSelect={(item) => {
                handleChangeAgent(item.id_agent);
              }}
            />

            <CommandDropdown
              label="Pilih Team Leader"
              value={displayedLeader}
              options={data.teamLeaderOptions}
              placeholder="Pilih team leader"
              searchPlaceholder="Cari team leader..."
              disabled={!selectedAgentId}
              accent
              onSelect={(item) => {
                setSelectedLeaderId(item.id_agent);
                persistSelection(selectedAgentId, item.id_agent);
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/58 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              Agent:{" "}
              <span className="text-white/85">
                {selectedAgentObject?.nama ?? agent?.nama ?? "-"}
              </span>
            </span>

            <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.10)]">
              TL dipilih:{" "}
              <span className="text-emerald-200">
                {displayedLeader?.nama ?? "Belum dipilih"}
              </span>
            </span>

            <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-xs text-white/58 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              Downline:{" "}
              <span className="text-white/85">{data.downlines.length}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveLeader}
            disabled={!selectedAgentId || !selectedLeaderId || saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-semibold text-[#06281f] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 shadow-[0_10px_30px_rgba(16,185,129,0.22)]"
          >
            <Save size={16} />
            {saving ? "Menyimpan..." : "Simpan Team Leader"}
          </button>
        </div>
      </GlassCard>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="h-[320px] animate-pulse rounded-[30px] bg-white/[0.035]" />
          </div>
          <div className="lg:col-span-7">
            <div className="h-[320px] animate-pulse rounded-[30px] bg-white/[0.035]" />
          </div>
        </div>
      ) : (
        <div className="relative z-0 grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <HeroCard
              title="Agent yang Closing"
              subtitle="Profil utama dari agent yang sedang dipilih"
              icon={<User2 size={20} />}
              tone="emerald"
            >
              <div className="grid gap-3">
                <HeroStat
                  icon={<User2 size={14} />}
                  label="Nama Agent"
                  value={selectedAgentObject?.nama ?? "-"}
                  accent
                />
                <HeroStat
                  icon={<BadgeCheck size={14} />}
                  label="ID Agent"
                  value={selectedAgentObject?.id_agent ?? "-"}
                />
                <HeroStat
                  icon={<Building2 size={14} />}
                  label="Kantor"
                  value={selectedAgentObject?.kantor ?? "-"}
                />
                <HeroStat
                  icon={<ShieldCheck size={14} />}
                  label="Jabatan"
                  value={selectedAgentObject?.jabatan ?? "-"}
                />
              </div>
            </HeroCard>
          </div>

          <div className="space-y-4 lg:col-span-7">
            <div className="grid gap-4 md:grid-cols-2">
              <RelationCard
                title="Upline"
                subtitle="Agent yang mengajak / mereferensikan"
                person={data.upline}
                icon={<GitBranch size={18} />}
              />

              <RelationCard
                title="Team Leader"
                subtitle="Langsung mengikuti pilihan dari dropdown"
                person={displayedLeader}
                icon={<Crown size={18} />}
                accent
              />
            </div>

            <GlassCard className="overflow-hidden p-5 sm:p-6">
              <SectionHeader
                icon={<Users size={18} />}
                title="Downline Agent"
                subtitle="Daftar agent yang berada di bawah agent ini"
              />

              <div className="mt-5">
                {data.downlines.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {data.downlines.map((item) => (
                      <DownlineCard key={item.id_agent} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Belum ada downline"
                    subtitle="Agent ini belum memiliki downline yang terdaftar."
                  />
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}