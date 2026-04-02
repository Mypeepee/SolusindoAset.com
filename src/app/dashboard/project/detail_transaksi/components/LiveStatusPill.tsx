"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Sparkles } from "lucide-react";

import type { ProjectStatus } from "./types";
import { STATUS_LABEL, cn } from "./utils";

type Props = {
  projectId: string;
  createdByAgentId?: string | null;
  status: ProjectStatus;
};

type SessionUser = {
  agentId?: string | null;
};

const STATUS_OPTIONS: Array<{
  value: ProjectStatus;
  description: string;
}> = [
  {
    value: "pendanaan_terbuka",
    description: "Project masih menerima pendanaan investor.",
  },
  {
    value: "pendanaan_penuh",
    description: "Target pendanaan telah terpenuhi.",
  },
  {
    value: "pengurusan_dokumen",
    description: "Masuk tahap legal dan administrasi dokumen.",
  },
  {
    value: "eksekusi_pengosongan",
    description: "Masuk tahap pengosongan dan eksekusi aset.",
  },
  {
    value: "renovasi",
    description: "Aset sedang direnovasi dan ditingkatkan nilainya.",
  },
  {
    value: "sedang_dijual",
    description: "Aset sedang dipasarkan untuk exit.",
  },
  {
    value: "terjual",
    description: "Aset berhasil dijual.",
  },
  {
    value: "dibatalkan",
    description: "Project dibatalkan dan tidak dilanjutkan.",
  },
];

const STATUS_STYLES: Record<
  ProjectStatus,
  {
    pill: string;
    dot: string;
    chevron: string;
    menuAccent: string;
    optionIdle: string;
    optionActive: string;
  }
> = {
  pendanaan_terbuka: {
    pill: "border-amber-300/20 bg-amber-400/10 text-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.05),0_10px_30px_rgba(251,191,36,0.08)]",
    dot: "bg-amber-300",
    chevron: "text-amber-200/80",
    menuAccent: "from-amber-300/50 via-amber-200/10 to-transparent",
    optionIdle: "hover:border-amber-300/20 hover:bg-amber-400/10",
    optionActive: "border-amber-300/25 bg-amber-400/12 text-amber-100",
  },
  pendanaan_penuh: {
    pill: "border-violet-300/20 bg-violet-400/10 text-violet-200 shadow-[0_0_0_1px_rgba(196,181,253,0.05),0_10px_30px_rgba(167,139,250,0.10)]",
    dot: "bg-violet-300",
    chevron: "text-violet-200/80",
    menuAccent: "from-violet-300/50 via-violet-200/10 to-transparent",
    optionIdle: "hover:border-violet-300/20 hover:bg-violet-400/10",
    optionActive: "border-violet-300/25 bg-violet-400/12 text-violet-100",
  },
  pengurusan_dokumen: {
    pill: "border-sky-300/20 bg-sky-400/10 text-sky-200 shadow-[0_0_0_1px_rgba(125,211,252,0.05),0_10px_30px_rgba(56,189,248,0.10)]",
    dot: "bg-sky-300",
    chevron: "text-sky-200/80",
    menuAccent: "from-sky-300/50 via-sky-200/10 to-transparent",
    optionIdle: "hover:border-sky-300/20 hover:bg-sky-400/10",
    optionActive: "border-sky-300/25 bg-sky-400/12 text-sky-100",
  },
  eksekusi_pengosongan: {
    pill: "border-orange-300/20 bg-orange-400/10 text-orange-200 shadow-[0_0_0_1px_rgba(253,186,116,0.05),0_10px_30px_rgba(251,146,60,0.10)]",
    dot: "bg-orange-300",
    chevron: "text-orange-200/80",
    menuAccent: "from-orange-300/50 via-orange-200/10 to-transparent",
    optionIdle: "hover:border-orange-300/20 hover:bg-orange-400/10",
    optionActive: "border-orange-300/25 bg-orange-400/12 text-orange-100",
  },
  renovasi: {
    pill: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_0_1px_rgba(103,232,249,0.05),0_10px_30px_rgba(34,211,238,0.10)]",
    dot: "bg-cyan-300",
    chevron: "text-cyan-200/80",
    menuAccent: "from-cyan-300/50 via-cyan-200/10 to-transparent",
    optionIdle: "hover:border-cyan-300/20 hover:bg-cyan-400/10",
    optionActive: "border-cyan-300/25 bg-cyan-400/12 text-cyan-100",
  },
  sedang_dijual: {
    pill: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200 shadow-[0_0_0_1px_rgba(110,231,183,0.05),0_10px_30px_rgba(16,185,129,0.10)]",
    dot: "bg-emerald-300",
    chevron: "text-emerald-200/80",
    menuAccent: "from-emerald-300/50 via-emerald-200/10 to-transparent",
    optionIdle: "hover:border-emerald-300/20 hover:bg-emerald-400/10",
    optionActive: "border-emerald-300/25 bg-emerald-400/12 text-emerald-100",
  },
  terjual: {
    pill: "border-lime-300/20 bg-lime-400/10 text-lime-200 shadow-[0_0_0_1px_rgba(190,242,100,0.05),0_10px_30px_rgba(132,204,22,0.10)]",
    dot: "bg-lime-300",
    chevron: "text-lime-200/80",
    menuAccent: "from-lime-300/50 via-lime-200/10 to-transparent",
    optionIdle: "hover:border-lime-300/20 hover:bg-lime-400/10",
    optionActive: "border-lime-300/25 bg-lime-400/12 text-lime-100",
  },
  dibatalkan: {
    pill: "border-rose-300/20 bg-rose-400/10 text-rose-200 shadow-[0_0_0_1px_rgba(253,164,175,0.05),0_10px_30px_rgba(244,63,94,0.10)]",
    dot: "bg-rose-300",
    chevron: "text-rose-200/80",
    menuAccent: "from-rose-300/50 via-rose-200/10 to-transparent",
    optionIdle: "hover:border-rose-300/20 hover:bg-rose-400/10",
    optionActive: "border-rose-300/25 bg-rose-400/12 text-rose-100",
  },
};

function StaticStatusBadge({ status }: { status: ProjectStatus }) {
  const styles = STATUS_STYLES[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-xl",
        styles.pill
      )}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", styles.dot)} />
      {STATUS_LABEL[status]}
    </div>
  );
}

export default function LiveStatusPill({
  projectId,
  createdByAgentId,
  status,
}: Props) {
  const { data: session } = useSession();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus>(status);
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const sessionAgentId =
    ((session?.user as SessionUser | undefined)?.agentId ?? null) || null;

  const canEdit =
    Boolean(projectId) &&
    Boolean(createdByAgentId) &&
    Boolean(sessionAgentId) &&
    createdByAgentId === sessionAgentId;

  const styles = STATUS_STYLES[currentStatus];

  async function handleSelect(nextStatus: ProjectStatus) {
    if (!canEdit) return;
    if (nextStatus === currentStatus) {
      setOpen(false);
      return;
    }

    try {
      setError("");
      setPendingStatus(nextStatus);

      const response = await fetch(`/api/project/${projectId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.message || "Gagal memperbarui status project."
        );
      }

      setCurrentStatus(nextStatus);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Terjadi kesalahan saat mengubah status.");
    } finally {
      setPendingStatus(null);
    }
  }

  if (!canEdit) {
    return <StaticStatusBadge status={currentStatus} />;
  }

  return (
    <div ref={rootRef} className="relative inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen((prev) => !prev);
        }}
        disabled={Boolean(pendingStatus)}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-xl transition duration-200",
          "hover:scale-[1.01] active:scale-[0.99]",
          "focus:outline-none focus:ring-2 focus:ring-white/20",
          styles.pill
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", styles.dot)} />

        <span>{STATUS_LABEL[currentStatus]}</span>

        {pendingStatus ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 transition duration-200",
              styles.chevron,
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+12px)] z-[80] w-[min(92vw,370px)] overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(7,10,17,0.96),rgba(4,6,11,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
          <div
            className={cn(
              "absolute inset-x-0 top-0 h-px bg-gradient-to-r",
              styles.menuAccent
            )}
          />
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-8 bottom-0 h-20 w-20 rounded-full bg-white/[0.05] blur-3xl" />

          <div className="relative p-3">
            <div className="mb-2 flex items-center justify-between gap-3 px-2 pb-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Ubah live status
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Hanya penyelenggara project yang bisa mengubah
                </div>
              </div>

              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                <Sparkles className="h-3 w-3" />
                Organizer
              </div>
            </div>

            <div className="space-y-1">
              {STATUS_OPTIONS.map((option) => {
                const isActive = option.value === currentStatus;
                const isLoading = option.value === pendingStatus;
                const optionStyles = STATUS_STYLES[option.value];

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    disabled={Boolean(pendingStatus)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[18px] border border-transparent px-3 py-3 text-left transition duration-200",
                      "bg-white/[0.02] text-slate-200",
                      optionStyles.optionIdle,
                      isActive && optionStyles.optionActive
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                        optionStyles.dot
                      )}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {STATUS_LABEL[option.value]}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {option.description}
                      </span>
                    </span>

                    <span className="mt-0.5 shrink-0">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      ) : isActive ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="px-2 pt-3 text-xs text-rose-300">{error}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}