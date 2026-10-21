"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "@iconify/react";
import {
  ArrowDownLeft,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Users2,
  X,
} from "lucide-react";

import type { ProjectDetailViewModel } from "./types";
import { formatIDR, getInitials, normalizeImage } from "./utils";
import { EmptyState, SectionCard } from "./shared";
import {
  buildOwnershipDisplayMap,
  ownershipDenominator,
  toCommitted,
} from "@/lib/investor-ownership";

type PaymentStatus = "menunggu_pembayaran" | "dibayar_sebagian" | "lunas";

type InvestorItem = ProjectDetailViewModel["investors"][number] & {
  status: PaymentStatus | string;
};

const STATUS_OPTIONS: PaymentStatus[] = [
  "menunggu_pembayaran",
  "dibayar_sebagian",
  "lunas",
];

const STATUS_META: Record<
  PaymentStatus,
  {
    label: string;
    dot: string;
    chip: string;
    button: string;
    optionGlow: string;
    description: string;
    icon: string;
    iconColor: string;
  }
> = {
  menunggu_pembayaran: {
    label: "Menunggu",
    dot: "bg-amber-300",
    chip:
      "border-amber-400/30 bg-amber-500/10 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.12)]",
    button:
      "border-amber-400/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(255,255,255,0.03))] text-amber-100 hover:border-amber-300/50 hover:shadow-[0_0_30px_rgba(245,158,11,0.14)]",
    optionGlow: "group-hover:bg-amber-400/10",
    description: "Dana investor belum dikonfirmasi masuk.",
    icon: "solar:hourglass-line-bold-duotone",
    iconColor: "text-amber-200",
  },
  dibayar_sebagian: {
    label: "Sebagian",
    dot: "bg-sky-300",
    chip:
      "border-sky-400/30 bg-sky-500/10 text-sky-100 shadow-[0_0_25px_rgba(56,189,248,0.12)]",
    button:
      "border-sky-400/35 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(255,255,255,0.03))] text-sky-100 hover:border-sky-300/50 hover:shadow-[0_0_30px_rgba(14,165,233,0.14)]",
    optionGlow: "group-hover:bg-sky-400/10",
    description: "Sebagian modal sudah diterima; masih ada sisa komitmen.",
    icon: "solar:pie-chart-2-bold-duotone",
    iconColor: "text-sky-200",
  },
  lunas: {
    label: "Lunas",
    dot: "bg-emerald-300",
    chip:
      "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 shadow-[0_0_25px_rgba(16,185,129,0.12)]",
    button:
      "border-emerald-400/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(255,255,255,0.03))] text-emerald-100 hover:border-emerald-300/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.14)]",
    optionGlow: "group-hover:bg-emerald-400/10",
    description: "Pembayaran investor sudah diterima penuh.",
    icon: "solar:check-circle-bold-duotone",
    iconColor: "text-emerald-200",
  },
};

function normalizeStatus(value: unknown): PaymentStatus {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "lunas") return "lunas";
  if (normalized === "dibayar_sebagian") return "dibayar_sebagian";
  return "menunggu_pembayaran";
}

function InvestorIdentity({
  name,
  avatar,
  note,
}: {
  name: string;
  avatar?: string | null;
  note?: string | null;
}) {
  const src = normalizeImage(avatar);
  const displayName = name?.trim() || "Investor";
  const helper = note?.trim() || "";

  return (
    <div className="flex min-w-0 items-center gap-3">
      {src ? (
        <img
          src={src}
          alt={displayName}
          className="h-11 w-11 shrink-0 rounded-full border border-white/10 object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_12px_30px_rgba(0,0,0,0.28)] md:h-12 md:w-12"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-base font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)] md:h-12 md:w-12 md:text-lg">
          {getInitials(displayName)}
        </div>
      )}

      <div className="min-w-0 md:max-w-[220px]">
        <div className="truncate text-[13.5px] font-semibold text-white md:text-[14.5px]">
          {displayName}
        </div>
        {helper ? (
          <div className="truncate text-[11px] text-slate-500 md:text-xs">
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileFieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 xl:hidden">
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={[
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold backdrop-blur-xl",
        meta.chip,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", meta.dot].join(" ")} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

function PaymentControl({
  status,
  paid,
  remaining,
  disabled,
  onPay,
}: {
  status: PaymentStatus;
  paid: number;
  remaining: number;
  disabled?: boolean;
  onPay: () => void;
}) {
  const meta = STATUS_META[status];
  const actionLabel = paid > 0 ? "Lanjut bayar" : "Terima dana";

  if (remaining <= 0) return <StatusBadge status="lunas" />;

  return (
    <div className="inline-flex max-w-full items-center gap-1 rounded-xl border border-white/10 bg-black/15 p-1 shadow-[0_8px_22px_rgba(0,0,0,0.16)]">
      <div
        className={`flex h-8 shrink-0 items-center justify-center px-2 ${meta.iconColor}`}
        title={`Status pembayaran: ${meta.label}`}
        aria-label={`Status pembayaran: ${meta.label}`}
      >
        <Icon icon={meta.icon} aria-hidden className="text-[18px]" />
        <span className="ml-1.5 hidden max-w-[88px] truncate text-xs font-semibold text-white/85 2xl:inline">
          {meta.label}
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onPay}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-cyan-300 px-2.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {disabled ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowDownLeft className="h-3.5 w-3.5" />
        )}
        <span className="hidden lg:inline">{actionLabel}</span>
        <span className="lg:hidden">Bayar</span>
      </button>
    </div>
  );
}

function FuturisticStatusDropdown({
  value,
  onChange,
  disabled,
}: {
  value: PaymentStatus;
  onChange: (nextValue: PaymentStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = STATUS_META[value];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative z-[80] w-full max-w-[188px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={[
          "group flex h-11 w-[188px] max-w-full items-center justify-between gap-3 rounded-2xl border px-4 text-sm font-semibold backdrop-blur-xl transition duration-200",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_35px_rgba(15,23,42,0.42)]",
          "disabled:cursor-not-allowed disabled:opacity-70",
          active.button,
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={["h-2.5 w-2.5 shrink-0 rounded-full", active.dot].join(
              " "
            )}
          />
          <span className="truncate">{active.label}</span>
        </span>

        {disabled ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-white/70 transition-transform duration-200",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        )}
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+12px)] right-0 z-[120] w-[280px] rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(7,12,24,0.98))] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.52),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl">
          <div className="mb-2 flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5" />
            Ubah status pembayaran
          </div>

          {STATUS_OPTIONS.map((status) => {
            const meta = STATUS_META[status];
            const selected = status === value;

            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (status !== value) onChange(status);
                }}
                className={[
                  "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left transition",
                  selected
                    ? "border-cyan-300/25 bg-white/[0.06]"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                ].join(" ")}
              >
                <div
                  className={[
                    "absolute inset-0 opacity-0 transition-opacity",
                    meta.optionGlow,
                    "group-hover:opacity-100",
                  ].join(" ")}
                />

                <div
                  className={[
                    "relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    meta.dot,
                  ].join(" ")}
                />

                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-white">{meta.label}</span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-cyan-300" />
                    ) : null}
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {meta.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function PaymentSheet({
  investor,
  onClose,
  onConfirm,
}: {
  investor: InvestorItem;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const committed = toCommitted(investor.committed);
  const paid = toCommitted(investor.paid);
  const remaining = Math.max(0, committed - paid);
  const [mode, setMode] = useState<"partial" | "settle">("partial");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const payment = Number(amount || 0);

  function chooseMode(nextMode: "partial" | "settle") {
    setMode(nextMode);
    setAmount(nextMode === "settle" ? String(remaining) : "");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payment || payment <= 0) return setError("Masukkan nominal yang diterima.");
    if (payment > remaining) return setError("Nominal tidak boleh melebihi sisa komitmen.");
    setSubmitting(true);
    setError("");
    try {
      await onConfirm(payment);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pembayaran belum dapat disimpan.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, submitting]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#020617]/65 p-4 backdrop-blur-md">
      <button
        type="button"
        aria-label="Tutup dialog penerimaan dana"
        onClick={onClose}
        disabled={submitting}
        className="absolute inset-0 cursor-default"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#0A0D14] shadow-[0_24px_70px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-300/65 to-transparent" />

        <div className="flex items-start gap-3 px-5 pb-3 pt-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 id="payment-dialog-title" className="text-[15px] font-semibold text-white">
              Terima dana
            </h3>
            <p className="mt-0.5 truncate text-sm text-slate-400">{investor.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form id="payment-receipt-form" onSubmit={submit} className="space-y-4 px-5 pb-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[.14em] text-slate-500">Sisa komitmen</p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-amber-200">
                {formatIDR(remaining)}
              </p>
            </div>
            <div className="min-w-0 border-l border-white/[0.08] pl-4 text-right">
              <p className="text-[10px] font-medium uppercase tracking-[.14em] text-slate-500">Sudah masuk</p>
              <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-emerald-200">
                {formatIDR(paid)}
              </p>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-2 rounded-xl bg-white/[0.05] p-1">
              <button
                type="button"
                onClick={() => chooseMode("partial")}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  mode === "partial"
                    ? "bg-white/[0.12] text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Bayar sebagian
              </button>
              <button
                type="button"
                onClick={() => chooseMode("settle")}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  mode === "settle"
                    ? "bg-emerald-400/[.14] text-emerald-100 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Lunasi sisa
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium uppercase tracking-[.15em] text-white/45">
              Nominal diterima
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/[.18] px-3.5 py-2.5 transition focus-within:border-cyan-300/45 focus-within:ring-2 focus-within:ring-cyan-300/10">
              <span className="text-sm font-semibold text-slate-400">Rp</span>
              <input
                inputMode="numeric"
                autoFocus
                value={amount ? new Intl.NumberFormat("id-ID").format(Number(amount)) : ""}
                onChange={(event) => {
                  const rawAmount = digits(event.target.value);
                  setMode("partial");
                  setAmount(
                    rawAmount
                      ? String(Math.min(Number(rawAmount), remaining))
                      : ""
                  );
                  setError("");
                }}
                disabled={submitting || mode === "settle"}
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent text-xl font-semibold tabular-nums tracking-tight text-white outline-none placeholder:text-white/20 disabled:text-white/75"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {mode === "settle"
                ? "Sisa diisi otomatis dan status berubah menjadi Lunas."
                : `Maksimal ${formatIDR(remaining)}. Dana akan tercatat sebagai uang masuk proyek.`}
            </p>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || remaining <= 0}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Mencatat…</>
            ) : (
              <><ArrowDownLeft className="h-4 w-4" />Catat penerimaan</>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function InvestorBookCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const { data: session, status: sessionStatus } = useSession();

  const currentAgentId =
    (session?.user as { agentId?: string } | null)?.agentId ?? null;

  const canManagePaymentStatus =
    sessionStatus === "authenticated" &&
    !!currentAgentId &&
    currentAgentId === project.createdById;

  const initialInvestors = useMemo(
    () =>
      ([...project.investors] as InvestorItem[])
        .sort(
          (a, b) => toCommitted(b.committed) - toCommitted(a.committed)
        )
        .map((item) => ({
          ...item,
          status: normalizeStatus(item.status),
        })),
    [project.investors]
  );

  const [investors, setInvestors] = useState(initialInvestors);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [paymentInvestorId, setPaymentInvestorId] = useState<string | number | null>(null);

  useEffect(() => {
    setInvestors(initialInvestors);
  }, [initialInvestors]);

  const fundingTarget = toCommitted(project.fundingTarget);

  const ownershipDisplayMap = useMemo(() => {
    // Kepemilikan = modal DISETOR / max(target, Σsetor). Investor belum lunas
    // (paid 0) = 0%; sisa "belum terisi". Talangan (Σ>target) mendilusi.
    const totalPaid = investors.reduce(
      (sum, inv) => sum + toCommitted(inv.paid),
      0
    );
    const denom = ownershipDenominator(fundingTarget, totalPaid);
    const paidItems = investors.map((inv) => ({
      id: inv.id,
      committed: inv.paid,
    }));
    return buildOwnershipDisplayMap(paidItems, denom, {
      decimalSeparator: ".",
    });
  }, [investors, fundingTarget]);

  async function handlePayment(investorId: string | number, amount: number) {
    setFeedback("");
    setSavingId(investorId);

    try {
      const response = await fetch("/api/project/update_status_pembayaran", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id_project_investor: investorId,
          nominal_bayar: amount,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Gagal menyimpan status pembayaran.");
      }
      setInvestors((current) =>
        current.map((item) =>
          String(item.id) === String(investorId)
            ? {
                ...item,
                paid: result.data?.paid ?? item.paid,
                status: normalizeStatus(result.data?.status),
              }
            : item
        )
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Terjadi kendala saat menyimpan status pembayaran."
      );
      throw error;
    } finally {
      setSavingId(null);
    }
  }

  const paymentInvestor =
    investors.find((item) => String(item.id) === String(paymentInvestorId)) ??
    null;

  return (
    <SectionCard
      eyebrow="Investor Book"
      title="Partisipasi investor dan kualitas pembayaran"
      icon={<Users2 className="h-5 w-5" />}
      right={
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
          {investors.length} investor terdaftar
        </span>
      }
    >
      <div className="space-y-4">
        {canManagePaymentStatus ? (
          <div className="flex items-center gap-2 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] px-4 py-3 text-xs text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.06)]">
            <Sparkles className="h-4 w-4 shrink-0" />
            Catat dana saat diterima. Pembayaran sebagian menambah kas proyek dan menyisakan tagihan investor secara otomatis.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
            <Sparkles className="h-4 w-4 shrink-0 text-slate-400" />
            Status pembayaran hanya dapat diubah oleh penyelenggara project.
          </div>
        )}

        {feedback ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {feedback}
          </div>
        ) : null}

        {investors.length > 0 ? (
          <div className="relative overflow-visible rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.10),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] shadow-[0_12px_50px_rgba(2,6,23,0.36)]">
            <div className="hidden grid-cols-[1.15fr_1fr_0.62fr_1.12fr] gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 text-xs uppercase tracking-[0.24em] text-slate-500 xl:grid">
              <div>Investor</div>
              <div>Komitmen</div>
              <div className="text-center">Kepemilikan</div>
              <div className="text-center">Pembayaran</div>
            </div>

            <div className="divide-y divide-white/10">
              {investors.map((item) => {
                const status = normalizeStatus(item.status);
                const isSaving = String(savingId) === String(item.id);
                const committed = toCommitted(item.committed);
                // Kepemilikan dihitung dari modal DISETOR. Kalau komitmen dan
                // setoran berbeda, selisihnya wajib terlihat — kalau tidak,
                // investor bingung kenapa porsinya kecil/0 padahal komitmennya
                // besar.
                const paid = toCommitted(item.paid);
                const belumSetor = Math.max(0, committed - paid);
                const ownershipDisplay =
                  ownershipDisplayMap.get(String(item.id)) ?? {
                    ratio: null,
                    percent: null,
                    percentText: "—",
                  };

                return (
                  <div
                    key={String(item.id)}
                    className="relative z-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 px-4 py-4 text-sm text-slate-200 transition hover:z-10 hover:bg-white/[0.02] xl:grid-cols-[1.15fr_1fr_0.62fr_1.12fr] xl:items-center xl:px-5"
                  >
                    <div className="order-[-2] min-w-0 xl:order-none">
                      <MobileFieldLabel>Investor</MobileFieldLabel>
                      <InvestorIdentity
                        name={item.name}
                        avatar={item.avatar}
                        note={item.note}
                      />
                    </div>

                    <div className="min-w-0">
                      <MobileFieldLabel>Komitmen</MobileFieldLabel>
                      <div className="truncate font-semibold tabular-nums text-white">
                        {formatIDR(committed)}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#34d399)] transition-[width] duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, committed > 0 ? (paid / committed) * 100 : 0)
                            )}%`,
                          }}
                        />
                      </div>
                      {belumSetor > 0 ? (
                        <div className="mt-1 truncate text-[11px] text-amber-300/75">
                          belum disetor {formatIDR(belumSetor)}
                        </div>
                      ) : paid > 0 ? (
                        <div className="mt-1 truncate text-[11px] text-emerald-300/70">
                          modal masuk penuh
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 text-right xl:text-center">
                      <MobileFieldLabel>Kepemilikan</MobileFieldLabel>
                      <div className="truncate text-white md:text-center">
                        {ownershipDisplay.percentText}
                      </div>
                    </div>

                    <div className="order-[-1] min-w-0 justify-self-end xl:order-none xl:justify-self-auto">
                      <MobileFieldLabel>Status</MobileFieldLabel>
                      <div className="flex justify-end xl:justify-center">
                        {canManagePaymentStatus ? (
                          <PaymentControl
                            status={status}
                            paid={paid}
                            remaining={belumSetor}
                            disabled={isSaving}
                            onPay={() => setPaymentInvestorId(item.id)}
                          />
                        ) : <StatusBadge status={status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState text="Belum ada investor pada project ini." />
        )}
      </div>
      {paymentInvestor ? (
        <PaymentSheet
          investor={paymentInvestor}
          onClose={() => setPaymentInvestorId(null)}
          onConfirm={(amount) => handlePayment(paymentInvestor.id, amount)}
        />
      ) : null}
    </SectionCard>
  );
}
