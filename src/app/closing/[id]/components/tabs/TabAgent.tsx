"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  Crown,
  GitBranch,
  Globe2,
  Phone,
  Save,
  Search,
  ShieldCheck,
  User2,
  Users,
} from "lucide-react";

const COBROKE_AGENT_ID = "COBROKE";

function formatPhoneId(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 12)}`;
}

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
  foto?: string | null;
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
  agentLuarNama?: string;
  agentLuarKantor?: string;
  agentLuarTelepon?: string;
};

const COBROKE_RELATION: AgentRelation = {
  id_agent: COBROKE_AGENT_ID,
  nama: "Agent Luar",
  kantor: "Luar Kantor",
  jabatan: null,
  foto: null,
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
          <p className="mt-1 text-xs leading-5 text-zinc-400">{subtitle}</p>
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
      <div className="flex items-center gap-2 text-zinc-400">
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
      <div className="mt-1 text-xs text-zinc-400">{subtitle}</div>
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
            <div className="mt-1 text-sm text-zinc-400">{person.id_agent}</div>

            <div className="mt-4 grid gap-2">
              <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <span className="text-zinc-400">Kantor:</span> {person.kantor ?? "-"}
              </div>
              <div className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <span className="text-zinc-400">Jabatan:</span> {person.jabatan ?? "-"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-white/[0.03] px-4 py-8 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="text-sm font-medium text-white/72">Belum ada data</div>
          <div className="mt-1 text-xs text-zinc-400">
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
          <div className="mt-1 text-xs text-zinc-400">{item.id_agent}</div>
        </div>

        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.10)]">
          Agent
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-black/15 px-3 py-2 text-sm text-zinc-300">
        <span className="text-zinc-400">Kantor:</span> {item.kantor ?? "-"}
      </div>
    </div>
  );
}

/* ─── Avatar ─── */
function Avatar({
  person,
  size = 44,
  accent = false,
}: {
  person: AgentRelation;
  size?: number;
  accent?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const initials = person.nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "—";

  const showImg = !!person.foto && !imgFailed;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full font-bold",
        accent
          ? "ring-2 ring-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.30)]"
          : "ring-1 ring-white/15"
      )}
      style={{ width: size, height: size }}
    >
      {/* initials background — always present */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          accent
            ? "bg-gradient-to-br from-emerald-400/30 to-emerald-600/20 text-emerald-200"
            : "bg-gradient-to-br from-zinc-600/40 to-zinc-800/40 text-zinc-200"
        )}
        style={{ fontSize: size < 40 ? 11 : 14 }}
      >
        {initials}
      </div>

      {/* photo on top */}
      {person.foto && (
        <img
          src={person.foto}
          alt={person.nama}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
            showImg ? "opacity-100" : "opacity-0"
          )}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}

/* ─── AgentSelector — trigger is always a card, opens dropdown to change ─── */
function AgentSelector({
  value,
  options,
  placeholder,
  searchPlaceholder,
  onSelect,
  disabled = false,
  accent = false,
  showExternalOption = false,
}: {
  value: AgentRelation | null;
  options: AgentRelation[];
  placeholder: string;
  searchPlaceholder: string;
  onSelect: (item: AgentRelation) => void;
  disabled?: boolean;
  accent?: boolean;
  showExternalOption?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setKeyword("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setKeyword(""); }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) =>
      `${item.nama} ${item.id_agent} ${item.kantor ?? ""}`.toLowerCase().includes(q)
    );
  }, [keyword, options]);

  return (
    <div ref={wrapperRef} className={cn("relative", open && "z-[200]")}>
      {/* ── Trigger ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl p-3 text-left transition",
          disabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-pointer hover:opacity-90",
          accent
            ? "bg-emerald-500/[0.08] shadow-[0_0_0_1px_rgba(16,185,129,0.18)]"
            : "bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]",
          open && !accent && "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
          open && accent && "shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
        )}
      >
        {value ? (
          value.id_agent === COBROKE_AGENT_ID ? (
            <>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/25">
                <Globe2 size={18} className="text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-violet-200">
                  Agent Luar
                </div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-400">
                  Data agent diisi di bawah
                </div>
              </div>
            </>
          ) : (
            <>
              <Avatar person={value} size={44} accent={accent} />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-sm font-semibold", accent ? "text-emerald-200" : "text-white")}>
                  {value.nama}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-400">
                  {value.id_agent}{value.kantor ? ` · ${value.kantor}` : ""}
                </div>
              </div>
            </>
          )
        ) : (
          <>
            <div className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              accent ? "bg-emerald-500/10" : "bg-white/[0.04]"
            )}>
              <User2 size={18} className={accent ? "text-emerald-500/60" : "text-zinc-400"} />
            </div>
            <span className="text-sm text-zinc-400">{placeholder}</span>
          </>
        )}
        <ChevronDown
          size={16}
          className={cn(
            "ml-auto shrink-0 transition-transform duration-200",
            accent ? "text-emerald-500/50" : "text-zinc-400",
            open && "rotate-180"
          )}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && !disabled && (
        <div className="absolute left-0 top-full z-[300] mt-2 w-full overflow-hidden rounded-2xl bg-[#0d1211] shadow-[0_24px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)]">
          {/* search */}
          <div className="border-b border-white/[0.06] p-2.5">
            <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5">
              <Search size={14} className="shrink-0 text-zinc-400" />
              <input
                ref={inputRef}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* list */}
          <div className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length > 0 ? (
              <div className="space-y-0.5">
                {filtered.map((item) => {
                  const sel = value?.id_agent === item.id_agent;
                  return (
                    <button
                      key={item.id_agent}
                      type="button"
                      onClick={() => { onSelect(item); setOpen(false); setKeyword(""); }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        sel
                          ? "bg-emerald-500/10 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]"
                          : "hover:bg-white/[0.04]"
                      )}
                    >
                      <Avatar person={item} size={36} accent={sel} />
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-sm font-medium", sel ? "text-emerald-200" : "text-white")}>
                          {item.nama}
                        </div>
                        <div className="truncate text-[11px] text-zinc-400">
                          {item.id_agent}{item.kantor ? ` · ${item.kantor}` : ""}
                        </div>
                      </div>
                      {sel && <Check size={14} className="shrink-0 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-zinc-400">
                Tidak ada hasil
              </div>
            )}

            {showExternalOption && (
              <>
                <div className="mx-2 my-1.5 h-px bg-white/[0.06]" />
                <button
                  type="button"
                  onClick={() => { onSelect(COBROKE_RELATION); setOpen(false); setKeyword(""); }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    value?.id_agent === COBROKE_AGENT_ID
                      ? "bg-violet-500/10 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.20)]"
                      : "hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/20">
                    <Globe2 size={14} className="text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm font-medium", value?.id_agent === COBROKE_AGENT_ID ? "text-violet-200" : "text-zinc-200")}>
                      Agent Luar
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      Input manual nama, kantor & telepon
                    </div>
                  </div>
                  {value?.id_agent === COBROKE_AGENT_ID && <Check size={14} className="shrink-0 text-violet-400" />}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export type AgentSelection = {
  id_agent: string;
  isLuar: boolean;
  luarNama?: string;
  luarKantor?: string;
  luarTelepon?: string;
};

export default function TabAgent({
  agent,
  initialSelectedId,
  onNext,
  onBack,
  onAgentChange,
  onLeaderChange,
  onAgentSelect,
  readOnly = false,
}: {
  agent: Agent | null;
  initialSelectedId?: string;
  leader?: unknown;
  onNext?: () => void;
  onBack?: () => void;
  onAgentChange?: (name: string) => void;
  onLeaderChange?: (name: string) => void;
  onAgentSelect?: (selection: AgentSelection | null) => void;
  readOnly?: boolean;
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

  const [agentLuarNama, setAgentLuarNama] = useState("");
  const [agentLuarKantor, setAgentLuarKantor] = useState("");
  const [agentLuarTelepon, setAgentLuarTelepon] = useState("");

  const isCobroke = selectedAgentId === COBROKE_AGENT_ID;

  const initialAgentId = useMemo(
    () => initialSelectedId || agent?.id_agent || "",
    [initialSelectedId, agent?.id_agent]
  );
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
        agentLuarNama: parsed.agentLuarNama ?? "",
        agentLuarKantor: parsed.agentLuarKantor ?? "",
        agentLuarTelepon: parsed.agentLuarTelepon ?? "",
      };
    } catch (error) {
      console.error("Gagal membaca localStorage tab agent:", error);
      return null;
    }
  }

  function persistSelection(
    agentId: string,
    leaderId: string,
    luarNama = agentLuarNama,
    luarKantor = agentLuarKantor,
    luarTelepon = agentLuarTelepon,
  ) {
    if (typeof window === "undefined" || !storageKey) return;

    try {
      const payload: PersistedSelection = {
        selectedAgentId: agentId ?? "",
        selectedLeaderId: leaderId ?? "",
        agentLuarNama: luarNama,
        agentLuarKantor: luarKantor,
        agentLuarTelepon: luarTelepon,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (error) {
      console.error("Gagal menyimpan localStorage tab agent:", error);
    }
  }

  const selectedAgentObject = useMemo(() => {
    if (selectedAgentId === COBROKE_AGENT_ID) return COBROKE_RELATION;
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

        // In readOnly (closing) mode, always use the MOU's agent — skip localStorage
        const persisted = readOnly ? null : readPersistedSelection();
        const agentIdToLoad = persisted?.selectedAgentId || initialAgentId;
        const leaderIdToKeep = persisted?.selectedLeaderId || "";

        if (!cancelled) {
          if (agentIdToLoad === COBROKE_AGENT_ID) {
            // Tetap fetch agents list pakai initialAgentId supaya dropdown tidak kosong,
            // lalu override selection kembali ke COBROKE setelah fetch selesai.
            await fetchAgentRelations(initialAgentId, "");
            if (!cancelled) {
              const luarNama = persisted?.agentLuarNama ?? "";
              const luarKantor = persisted?.agentLuarKantor ?? "";
              const luarTelepon = persisted?.agentLuarTelepon ?? "";
              setSelectedAgentId(COBROKE_AGENT_ID);
              setSelectedLeaderId(leaderIdToKeep);
              setAgentLuarNama(luarNama);
              setAgentLuarKantor(luarKantor);
              setAgentLuarTelepon(luarTelepon);
              // fetchAgentRelations di atas menimpa localStorage — tulis ulang data COBROKE
              persistSelection(COBROKE_AGENT_ID, leaderIdToKeep, luarNama, luarKantor, luarTelepon);
            }
          } else {
            await fetchAgentRelations(agentIdToLoad, leaderIdToKeep);
          }
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

    if (nextAgentId === COBROKE_AGENT_ID) {
      setData((prev) => ({
        ...prev,
        selectedAgent: null,
        upline: null,
        teamLeader: null,
        downlines: [],
      }));
      // Pastikan agents list tetap terisi agar user bisa switch kembali ke agent internal
      if (data.agents.length === 0 && initialAgentId) {
        fetchAgentRelations(initialAgentId, "").then(() => {
          setSelectedAgentId(COBROKE_AGENT_ID);
          setSelectedLeaderId("");
          // fetchAgentRelations menimpa localStorage — tulis ulang data COBROKE
          persistSelection(COBROKE_AGENT_ID, "", agentLuarNama, agentLuarKantor, agentLuarTelepon);
        }).catch(console.error);
      }
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

  async function saveLeader(agentId: string, leaderId: string) {
    if (!agentId || !leaderId) return;

    try {
      setSaving(true);

      const res = await fetch(`/api/closing/listing/${initialAgentId}/agent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, teamLeaderId: leaderId }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan team leader");

      persistSelection(agentId, leaderId);
      await fetchAgentRelations(agentId, leaderId);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const displayedLeader = selectedLeaderObject;

  // sync nama ke hero card ClosingShell
  useEffect(() => {
    if (isCobroke) {
      onAgentChange?.(agentLuarNama || "Agent Luar");
    } else {
      onAgentChange?.(selectedAgentObject?.nama ?? "");
    }
  }, [isCobroke, agentLuarNama, selectedAgentObject?.nama]);

  useEffect(() => {
    onLeaderChange?.(displayedLeader?.nama ?? "");
  }, [displayedLeader?.nama]);

  // sync pilihan agent untuk keperluan save
  useEffect(() => {
    if (!selectedAgentId) { onAgentSelect?.(null); return; }
    if (isCobroke) {
      onAgentSelect?.({ id_agent: selectedAgentId, isLuar: true, luarNama: agentLuarNama, luarKantor: agentLuarKantor, luarTelepon: agentLuarTelepon });
    } else {
      onAgentSelect?.({ id_agent: selectedAgentId, isLuar: false });
    }
  }, [selectedAgentId, isCobroke, agentLuarNama, agentLuarKantor, agentLuarTelepon]);

  return (
    <div className="space-y-4">
      {/* ── Selector card ── */}
      <GlassCard glow className="relative z-40 overflow-visible p-5 sm:p-6">

        {/* label */}
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-400/80">
            Agent Structure
          </span>
        </div>

        {/* Lock notice when readOnly */}
        {readOnly && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <ShieldCheck size={13} className="shrink-0 text-zinc-500" />
            <p className="text-[11px] text-zinc-500">Data agent terkunci — tidak dapat diubah setelah closing dikonfirmasi.</p>
          </div>
        )}

        {/* two-column selectors */}
        <div className="grid gap-4 sm:grid-cols-2">

          {/* ─ Agent ─ */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
              Agent Closing
            </p>
            <AgentSelector
              value={selectedAgentObject}
              options={data.agents}
              placeholder="Cari & pilih agent..."
              searchPlaceholder="Nama, ID, kantor..."
              showExternalOption
              disabled={readOnly}
              onSelect={(item) => !readOnly && handleChangeAgent(item.id_agent)}
            />
          </div>

          {/* ─ Team Leader ─ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
                Team Leader
              </p>
              {saving && (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Menyimpan...
                </span>
              )}
            </div>
            <AgentSelector
              value={displayedLeader}
              options={data.teamLeaderOptions}
              placeholder={isCobroke ? "Pilih team leader (opsional)..." : selectedAgentId ? "Pilih team leader..." : "Pilih agent dulu"}
              searchPlaceholder="Cari team leader..."
              disabled={readOnly || !selectedAgentId}
              accent
              onSelect={(item) => {
                if (readOnly) return;
                setSelectedLeaderId(item.id_agent);
                persistSelection(selectedAgentId, item.id_agent);
                if (!isCobroke) {
                  saveLeader(selectedAgentId, item.id_agent);
                }
              }}
            />
          </div>
        </div>

        {/* ── Panel Agent Luar ── */}
        {isCobroke && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/20 bg-violet-500/[0.06]">
            <div className="flex items-center gap-2.5 border-b border-violet-500/15 px-4 py-3">
              <Globe2 size={14} className="shrink-0 text-violet-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-400/80">
                Data Agent Luar
              </span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {/* Nama */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  Nama Agent
                </label>
                <div className="flex h-10 items-center overflow-hidden rounded-xl bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]">
                  <div className="flex h-full w-9 shrink-0 items-center justify-center border-r border-white/[0.07]">
                    <User2 size={13} className="text-zinc-500" />
                  </div>
                  <input
                    type="text"
                    value={agentLuarNama}
                    readOnly={readOnly}
                    onChange={(e) => {
                      if (readOnly) return;
                      setAgentLuarNama(e.target.value);
                      persistSelection(selectedAgentId, selectedLeaderId, e.target.value, agentLuarKantor, agentLuarTelepon);
                    }}
                    placeholder="Nama lengkap"
                    className={`h-full w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600${readOnly ? " cursor-default" : ""}`}
                  />
                </div>
              </div>

              {/* Kantor */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  Kantor / Perusahaan
                </label>
                <div className="flex h-10 items-center overflow-hidden rounded-xl bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]">
                  <div className="flex h-full w-9 shrink-0 items-center justify-center border-r border-white/[0.07]">
                    <Building2 size={13} className="text-zinc-500" />
                  </div>
                  <input
                    type="text"
                    value={agentLuarKantor}
                    readOnly={readOnly}
                    onChange={(e) => {
                      if (readOnly) return;
                      setAgentLuarKantor(e.target.value);
                      persistSelection(selectedAgentId, selectedLeaderId, agentLuarNama, e.target.value, agentLuarTelepon);
                    }}
                    placeholder="Nama kantor / developer"
                    className={`h-full w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600${readOnly ? " cursor-default" : ""}`}
                  />
                </div>
              </div>

              {/* Telepon */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  Nomor Telepon
                </label>
                <div className="flex h-10 items-center overflow-hidden rounded-xl bg-white/[0.05] shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]">
                  <div className="flex h-full shrink-0 items-center justify-center border-r border-white/[0.07] px-3 text-sm font-semibold text-zinc-400">
                    +62
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={agentLuarTelepon}
                    readOnly={readOnly}
                    onChange={(e) => {
                      if (readOnly) return;
                      const val = formatPhoneId(e.target.value);
                      setAgentLuarTelepon(val);
                      persistSelection(selectedAgentId, selectedLeaderId, agentLuarNama, agentLuarKantor, val);
                    }}
                    placeholder="812-3456-7890"
                    className={`h-full w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-zinc-600${readOnly ? " cursor-default" : ""}`}
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-violet-500/15 px-4 py-2.5 text-[11px] text-zinc-500">
              Data ini akan disimpan bersama transaksi. Team leader bisa dipilih untuk keperluan pembagian fee.
            </div>
          </div>
        )}
      </GlassCard>

      {/* ── Upline | Downline ── */}
      {!isCobroke && (loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-[180px] animate-pulse rounded-[30px] bg-white/[0.035]" />
          <div className="h-[180px] animate-pulse rounded-[30px] bg-white/[0.035]" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <RelationCard
            title="Upline"
            subtitle="Agent yang mereferensikan"
            person={data.upline}
            icon={<GitBranch size={18} />}
          />
          <GlassCard className="overflow-hidden p-5">
            <SectionHeader
              icon={<Users size={18} />}
              title="Downline"
              subtitle={`${data.downlines.length} agent di bawah`}
            />
            <div className="mt-4">
              {data.downlines.length > 0 ? (
                <div className="space-y-2">
                  {data.downlines.map((item) => (
                    <DownlineCard key={item.id_agent} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Belum ada downline"
                  subtitle="Agent ini belum memiliki downline."
                />
              )}
            </div>
          </GlassCard>
        </div>
      ))}

      {/* ── Navigation buttons ── */}
      {(onBack || onNext) && (
        <div className="flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={() => onBack()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 text-sm font-semibold text-zinc-400 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
            >
              <ChevronDown size={16} className="rotate-90" />
              Kembali ke Pilih Klien
            </button>
          ) : (
            <div />
          )}
          {onNext && (
            <button
              type="button"
              disabled={!selectedAgentId || saving || (isCobroke && !agentLuarNama.trim())}
              onClick={() => onNext()}
              className="inline-flex h-11 items-center gap-2.5 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Lanjut ke Transaksi
              <ChevronDown size={16} className="-rotate-90" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}