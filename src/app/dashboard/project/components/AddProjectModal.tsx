"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Landmark,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

export type jenis_pendanaan_enum = "terbuka" | "tertutup";

export type status_project_enum =
  | "pendanaan_terbuka"
  | "pendanaan_penuh"
  | "pengurusan_dokumen"
  | "eksekusi_pengosongan"
  | "renovasi"
  | "sedang_dijual"
  | "terjual"
  | "dibatalkan";

export type ListingOption = {
  id_listing: string;
  id_property?: string;
  judul?: string | null;
  slug?: string | null;
  alamat_property?: string | null;
  alamat_lengkap?: string | null;
  provinsi?: string | null;
  kota?: string | null;
  kecamatan?: string | null;
  kelurahan?: string | null;
  gambar_thumbnail?: string | null;
  gambar?: string | null;
  harga?: number | null;
  harga_promo?: number | null;
  nilai_limit_lelang?: number | null;
  uang_jaminan?: number | null;
  vendor?: string | null;
  kategori?: string | null;
  jenis_transaksi?: "PRIMARY" | "SECONDARY" | "LELANG" | "SEWA" | string;
  tanggal_lelang?: string | null;
};

export type CreateProjectFormValues = {
  id_listing: string | null;
  nama_project: string;
  alamat_property: string;
  provinsi: string;
  kota: string;
  kecamatan: string;
  kelurahan: string;
  gambar_thumbnail: string;
  tanggal_pembelian: string | null;
  harga_pembelian: number;
  estimasi_harga_jual: number;
  estimasi_profit_bersih: number;
  target_pendanaan: number;
  total_pendanaan: number;
  jenis_pendanaan: jenis_pendanaan_enum;
  status: status_project_enum;
  mulai_tanggal: string | null;
  estimasi_selesai: string | null;
  deskripsi_project: string;
  dibuat_oleh?: string;
  invitedInvestorIds: string[];

  nilai_limit_lelang: number;
  biaya_balik_nama: number;
  biaya_eksekusi: number;
};

export type ModalTierTheme = {
  nama: string;
  badge: string;
  actionButton: string;
  accentText: string;
  shell: string;
  overlay: string;
  edgeGlow: string;
  orbA: string;
  orbB: string;
  orbC: string;
  modalField: string;
  modalFieldFocus: string;
  modalMutedButton: string;
  modalMutedButtonHover: string;
  icon: LucideIcon;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateProjectFormValues) => void | Promise<void>;
  loading?: boolean;
  theme: ModalTierTheme;
  createdById?: string;
};

type WizardStep = 1 | 2;

type ListingApiResponse = {
  success: boolean;
  query?: string;
  total?: number;
  data?: ListingOption[];
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberInputValue(value: number) {
  return value === 0 ? "" : String(value);
}

function formatTransactionLabel(value?: string | null) {
  if (!value) return "-";
  if (value === "PRIMARY") return "Primary";
  if (value === "SECONDARY") return "Secondary";
  if (value === "LELANG") return "Lelang";
  if (value === "SEWA") return "Sewa";
  return value;
}

function formatCategoryLabel(value?: string | null) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getInitialForm(createdById?: string): CreateProjectFormValues {
  return {
    id_listing: null,
    nama_project: "",
    alamat_property: "",
    provinsi: "",
    kota: "",
    kecamatan: "",
    kelurahan: "",
    gambar_thumbnail: "",
    tanggal_pembelian: null,
    harga_pembelian: 0,
    estimasi_harga_jual: 0,
    estimasi_profit_bersih: 0,
    target_pendanaan: 0,
    total_pendanaan: 0,
    jenis_pendanaan: "terbuka",
    status: "pendanaan_terbuka",
    mulai_tanggal: null,
    estimasi_selesai: null,
    deskripsi_project: "",
    dibuat_oleh: createdById ?? "",
    invitedInvestorIds: [],
    nilai_limit_lelang: 0,
    biaya_balik_nama: 0,
    biaya_eksekusi: 0,
  };
}

function StepPill({
  step,
  currentStep,
  title,
  subtitle,
  accentText,
}: {
  step: WizardStep;
  currentStep: WizardStep;
  title: string;
  subtitle: string;
  accentText: string;
}) {
  const isActive = currentStep === step;
  const isDone = currentStep > step;

  return (
    <div
      className={`rounded-[24px] border p-4 transition ${
        isActive
          ? "border-white/20 bg-white/[0.08]"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${
            isActive || isDone
              ? "border-white/20 bg-white/[0.10] text-white"
              : "border-white/10 bg-white/[0.04] text-slate-400"
          }`}
        >
          {isDone ? <Check className="h-4 w-4" /> : step}
        </div>

        <div className="min-w-0">
          <p
            className={`text-sm font-bold ${
              isActive ? "text-white" : "text-slate-300"
            }`}
          >
            {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</p>
          {isActive ? (
            <p
              className={`mt-2 text-[11px] font-bold uppercase tracking-[0.18em] ${accentText}`}
            >
              Aktif
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  helper,
}: {
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  helper?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
        {Icon ? <Icon className="h-4 w-4 text-white/80" /> : null}
        <span>{label}</span>
      </div>
      {children}
      {helper ? (
        <p className="mt-2 text-xs leading-5 text-slate-400">{helper}</p>
      ) : null}
    </label>
  );
}

function MetricCard({
  label,
  value,
  helper,
  accentText,
}: {
  label: string;
  value: string;
  helper: string;
  accentText: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
      <p className={`mt-2 text-xs leading-5 ${accentText}`}>{helper}</p>
    </div>
  );
}

export default function AddProjectModal({
  open,
  onClose,
  onSubmit,
  loading = false,
  theme,
  createdById,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<CreateProjectFormValues>(() =>
    getInitialForm(createdById)
  );

  const [listingQuery, setListingQuery] = useState("");
  const [listingResults, setListingResults] = useState<ListingOption[]>([]);
  const [selectedListingSnapshot, setSelectedListingSnapshot] =
    useState<ListingOption | null>(null);
  const [listingLoading, setListingLoading] = useState(false);
  const [listingError, setListingError] = useState("");

  const TierIcon = theme.icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setForm(getInitialForm(createdById));
    setListingQuery("");
    setListingResults([]);
    setSelectedListingSnapshot(null);
    setListingError("");

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, createdById]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      try {
        setListingLoading(true);
        setListingError("");

        const params = new URLSearchParams();
        if (listingQuery.trim()) params.set("q", listingQuery.trim());
        params.set("limit", "8");

        const response = await fetch(`/api/project/modal?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });

        const result: ListingApiResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal mengambil data listing.");
        }

        setListingResults(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setListingResults([]);
        setListingError(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengambil listing."
        );
      } finally {
        setListingLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [open, listingQuery]);

  const selectedListing = useMemo(() => {
    if (selectedListingSnapshot?.id_listing === form.id_listing) {
      return selectedListingSnapshot;
    }

    return (
      listingResults.find((item) => item.id_listing === form.id_listing) ?? null
    );
  }, [listingResults, selectedListingSnapshot, form.id_listing]);

  const hargaPembelianComputed =
    Number(form.nilai_limit_lelang || 0) +
    Number(form.biaya_balik_nama || 0) +
    Number(form.biaya_eksekusi || 0);

  const profitComputed =
    Number(form.estimasi_harga_jual || 0) - Number(hargaPembelianComputed || 0);

  const roiPercent =
    hargaPembelianComputed > 0
      ? (profitComputed / hargaPembelianComputed) * 100
      : 0;

  const stepOneValid =
    !!form.id_listing &&
    form.nama_project.trim().length > 0 &&
    form.alamat_property.trim().length > 0;

  const stepTwoValid =
    form.nilai_limit_lelang > 0 &&
    form.target_pendanaan > 0 &&
    form.estimasi_harga_jual > 0;

  const canSubmit = stepOneValid && stepTwoValid;

  const inputClassName = `h-12 w-full rounded-2xl border px-4 text-sm text-white outline-none transition placeholder:text-slate-500 ${theme.modalField} ${theme.modalFieldFocus}`;
  const textareaClassName = `w-full rounded-2xl border px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 ${theme.modalField} ${theme.modalFieldFocus}`;

  function updateField<K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function selectListing(item: ListingOption) {
    const limitValue = Number(item.nilai_limit_lelang ?? item.harga ?? 0);

    setSelectedListingSnapshot(item);

    setForm((prev) => ({
      ...prev,
      id_listing: item.id_listing,
      nama_project:
        prev.nama_project ||
        item.alamat_property ||
        item.alamat_lengkap ||
        `Property #${item.id_listing}`,
      alamat_property:
        item.alamat_property ?? item.alamat_lengkap ?? prev.alamat_property,
      provinsi: item.provinsi ?? "",
      kota: item.kota ?? "",
      kecamatan: item.kecamatan ?? "",
      kelurahan: item.kelurahan ?? "",
      gambar_thumbnail:
        prev.gambar_thumbnail || item.gambar_thumbnail || item.gambar || "",
      nilai_limit_lelang:
        prev.nilai_limit_lelang > 0 ? prev.nilai_limit_lelang : limitValue,
      dibuat_oleh: prev.dibuat_oleh || createdById || "",
    }));
  }

  function handleNext() {
    if (step === 1 && stepOneValid) setStep(2);
  }

  function handleBack() {
    if (step === 2) setStep(1);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    await onSubmit({
      ...form,
      harga_pembelian: hargaPembelianComputed,
      estimasi_profit_bersih: profitComputed,
      dibuat_oleh: form.dibuat_oleh || createdById || "",
    });
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-md sm:items-center sm:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full max-w-7xl overflow-hidden rounded-[34px] border shadow-[0_30px_120px_rgba(0,0,0,0.45)] ${theme.shell} ${theme.edgeGlow}`}
      >
        <div className={`absolute inset-0 ${theme.overlay}`} />
        <div className="absolute inset-[1px] rounded-[33px] border border-white/[0.05]" />
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_100%)]" />

        <div
          className={`absolute -right-16 -top-10 h-44 w-44 rounded-full blur-3xl ${theme.orbA}`}
        />
        <div
          className={`absolute left-[8%] bottom-[-70px] h-40 w-40 rounded-full blur-3xl ${theme.orbB}`}
        />
        <div
          className={`absolute right-[28%] bottom-[-88px] h-36 w-36 rounded-full blur-3xl ${theme.orbC}`}
        />

        <div className="relative flex max-h-[94dvh] flex-col">
          <div className="border-b border-white/10 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">
                  Create Project Flow
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                    Tambahkan Project Pendanaan
                  </h2>

                  <div
                    className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur-md ${theme.badge}`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/15">
                      <TierIcon className="h-4 w-4" />
                    </span>
                    <span>{theme.nama}</span>
                  </div>
                </div>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                  Identifikasi property dulu, lalu susun struktur nilai dan biaya
                  agar project terasa rapi, premium, dan mudah dipahami investor.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-slate-200 transition ${theme.modalMutedButton} ${theme.modalMutedButtonHover}`}
                aria-label="Tutup modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <StepPill
                step={1}
                currentStep={step}
                title="Informasi Project"
                subtitle="Cari property, pilih listing, dan lengkapi identitas project."
                accentText={theme.accentText}
              />
              <StepPill
                step={2}
                currentStep={step}
                title="Nilai Property"
                subtitle="Limit lelang, biaya, target pendanaan, dan simulasi profit."
                accentText={theme.accentText}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-5">
                  {step === 1 ? (
                    <>
                      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                            <Search className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white">
                              Cari Listing Sumber
                            </h3>
                            <p className="text-sm text-slate-400">
                              Bisa pakai no ID property atau alamat.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                              type="text"
                              value={listingQuery}
                              onChange={(e) => setListingQuery(e.target.value)}
                              placeholder="Cari ID property / alamat / kota / kecamatan..."
                              className={`${inputClassName} pl-11`}
                            />
                          </div>

                          <div className="mt-3 max-h-[440px] space-y-3 overflow-y-auto pr-1">
                            {listingLoading ? (
                              <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-300">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Mengambil listing...</span>
                              </div>
                            ) : listingError ? (
                              <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-4 py-5 text-sm text-rose-200">
                                {listingError}
                              </div>
                            ) : listingResults.length > 0 ? (
                              listingResults.map((item) => {
                                const active = item.id_listing === form.id_listing;
                                const isLelang = item.jenis_transaksi === "LELANG";
                                const imageUrl =
                                  item.gambar_thumbnail || item.gambar || "";

                                return (
                                  <button
                                    key={item.id_listing}
                                    type="button"
                                    onClick={() => selectListing(item)}
                                    className={`w-full rounded-[28px] border p-4 text-left transition ${
                                      active
                                        ? "border-white/20 bg-white/[0.08]"
                                        : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                                    }`}
                                  >
                                    <div className="flex items-stretch gap-4">
                                      <div className="relative hidden h-[154px] w-[168px] shrink-0 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] sm:block">
                                        {imageUrl ? (
                                          <img
                                            src={imageUrl}
                                            alt={item.alamat_property || `Property ${item.id_listing}`}
                                            className="h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center text-slate-500">
                                            <Building2 className="h-8 w-8" />
                                          </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.55)_100%)]" />
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">
                                            Property #{item.id_listing}
                                          </span>

                                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                                            {formatCategoryLabel(item.kategori)}
                                          </span>

                                          <span
                                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                                              item.jenis_transaksi === "LELANG"
                                                ? "border-amber-300/20 bg-amber-400/10 text-amber-200"
                                                : "border-sky-300/20 bg-sky-400/10 text-sky-200"
                                            }`}
                                          >
                                            {formatTransactionLabel(item.jenis_transaksi)}
                                          </span>
                                        </div>

                                        <p className="mt-4 line-clamp-3 text-xl font-black leading-snug text-white">
                                          {item.alamat_property ||
                                            item.alamat_lengkap ||
                                            `Property #${item.id_listing}`}
                                        </p>

                                        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-400">
                                          {item.kelurahan ? <span>{item.kelurahan}</span> : null}
                                          {item.kecamatan ? <span>• {item.kecamatan}</span> : null}
                                          {item.kota ? <span>• {item.kota}</span> : null}
                                          {item.provinsi ? <span>• {item.provinsi}</span> : null}
                                        </div>

                                        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-base">
                                          {isLelang ? (
                                            <div>
                                              <span className="text-slate-500">
                                                Limit Lelang:{" "}
                                              </span>
                                              <span className="font-black text-white">
                                                {formatCurrency(
                                                  Number(item.nilai_limit_lelang ?? 0)
                                                )}
                                              </span>
                                            </div>
                                          ) : (
                                            <>
                                              <div>
                                                <span className="text-slate-500">
                                                  Harga:{" "}
                                                </span>
                                                <span className="font-black text-white">
                                                  {formatCurrency(Number(item.harga ?? 0))}
                                                </span>
                                              </div>

                                              {item.harga_promo &&
                                              Number(item.harga_promo) > 0 ? (
                                                <div>
                                                  <span className="text-slate-500">
                                                    Harga Promo:{" "}
                                                  </span>
                                                  <span className="font-black text-emerald-200">
                                                    {formatCurrency(
                                                      Number(item.harga_promo)
                                                    )}
                                                  </span>
                                                </div>
                                              ) : null}
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex shrink-0 items-start">
                                        <span
                                          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${
                                            active
                                              ? "border-white/20 bg-white/[0.08] text-white"
                                              : "border-white/10 bg-white/[0.04] text-slate-400"
                                          }`}
                                        >
                                          {active ? (
                                            <Check className="h-5 w-5" />
                                          ) : (
                                            <ChevronRight className="h-5 w-5" />
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })
                            ) : (
                              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                                Tidak ada listing yang cocok.
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white">
                              Informasi Project
                            </h3>
                            <p className="text-sm text-slate-400">
                              Lengkapi identitas project setelah property dipilih.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <Field label="Nama Project" icon={Sparkles}>
                            <input
                              type="text"
                              value={form.nama_project}
                              onChange={(e) =>
                                updateField("nama_project", e.target.value)
                              }
                              placeholder="Contoh: Akuisisi Property Surabaya Tahap 1"
                              className={inputClassName}
                              required
                            />
                          </Field>

                          <Field
                            label="Deskripsi Project"
                            icon={FileText}
                            helper="Tulis singkat, meyakinkan, dan mudah dibaca investor."
                          >
                            <textarea
                              rows={5}
                              value={form.deskripsi_project}
                              onChange={(e) =>
                                updateField("deskripsi_project", e.target.value)
                              }
                              placeholder="Jelaskan strategi project, kondisi aset, dan proyeksi singkat..."
                              className={textareaClassName}
                            />
                          </Field>

                          <Field label="Alamat Property" icon={MapPin}>
                            <textarea
                              rows={3}
                              value={form.alamat_property}
                              onChange={(e) =>
                                updateField("alamat_property", e.target.value)
                              }
                              placeholder="Alamat lengkap property"
                              className={textareaClassName}
                            />
                          </Field>
                        </div>
                      </section>
                    </>
                  ) : (
                    <>
                      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                            <Landmark className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white">
                              Nilai Property & Struktur Biaya
                            </h3>
                            <p className="text-sm text-slate-400">
                              Angka pokok dihubungkan ke nilai limit lelang atau nilai akuisisi property.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <Field
                            label="Nilai Limit / Nilai Akuisisi"
                            icon={Wallet}
                            helper="Untuk lelang ambil dari limit lelang. Untuk non-lelang bisa jadi basis harga masuk."
                          >
                            <input
                              type="number"
                              min={0}
                              value={numberInputValue(form.nilai_limit_lelang)}
                              onChange={(e) =>
                                updateField(
                                  "nilai_limit_lelang",
                                  parseNumber(e.target.value)
                                )
                              }
                              placeholder="0"
                              className={inputClassName}
                              required
                            />
                          </Field>

                          <Field
                            label="Biaya Balik Nama"
                            icon={FileText}
                            helper="Biaya legal dan administrasi perpindahan hak."
                          >
                            <input
                              type="number"
                              min={0}
                              value={numberInputValue(form.biaya_balik_nama)}
                              onChange={(e) =>
                                updateField(
                                  "biaya_balik_nama",
                                  parseNumber(e.target.value)
                                )
                              }
                              placeholder="0"
                              className={inputClassName}
                            />
                          </Field>

                          <Field
                            label="Biaya Eksekusi"
                            icon={Target}
                            helper="Biaya lapangan, pengosongan, operasional, dan kebutuhan eksekusi lainnya."
                          >
                            <input
                              type="number"
                              min={0}
                              value={numberInputValue(form.biaya_eksekusi)}
                              onChange={(e) =>
                                updateField(
                                  "biaya_eksekusi",
                                  parseNumber(e.target.value)
                                )
                              }
                              placeholder="0"
                              className={inputClassName}
                            />
                          </Field>

                          <Field
                            label="Target Pendanaan"
                            icon={Wallet}
                            helper="Total nominal yang ingin dibuka ke investor."
                          >
                            <input
                              type="number"
                              min={0}
                              value={numberInputValue(form.target_pendanaan)}
                              onChange={(e) =>
                                updateField(
                                  "target_pendanaan",
                                  parseNumber(e.target.value)
                                )
                              }
                              placeholder="0"
                              className={inputClassName}
                              required
                            />
                          </Field>

                          <div className="md:col-span-2">
                            <Field
                              label="Estimasi Harga Jual"
                              icon={TrendingUp}
                              helper="Dipakai untuk menghitung estimasi profit bersih."
                            >
                              <input
                                type="number"
                                min={0}
                                value={numberInputValue(form.estimasi_harga_jual)}
                                onChange={(e) =>
                                  updateField(
                                    "estimasi_harga_jual",
                                    parseNumber(e.target.value)
                                  )
                                }
                                placeholder="0"
                                className={inputClassName}
                                required
                              />
                            </Field>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md sm:p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                            <TrendingUp className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-white">
                              Simulasi Otomatis
                            </h3>
                            <p className="text-sm text-slate-400">
                              Semua perhitungan dirapikan otomatis agar cepat dibaca.
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <MetricCard
                            label="Harga Pembelian"
                            value={formatCurrency(hargaPembelianComputed)}
                            helper="Nilai masuk + biaya"
                            accentText={theme.accentText}
                          />
                          <MetricCard
                            label="Est. Harga Jual"
                            value={formatCurrency(form.estimasi_harga_jual)}
                            helper="Nilai exit"
                            accentText={theme.accentText}
                          />
                          <MetricCard
                            label="Est. Profit"
                            value={formatCurrency(profitComputed)}
                            helper="Jual - pembelian"
                            accentText={theme.accentText}
                          />
                          <MetricCard
                            label="ROI"
                            value={`${roiPercent.toFixed(2)}%`}
                            helper="Return proyeksi"
                            accentText={theme.accentText}
                          />
                        </div>
                      </section>
                    </>
                  )}
                </div>

                <aside className="space-y-5">
                  <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-md sm:p-5 xl:sticky xl:top-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                        <TierIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          Ringkasan Project
                        </p>
                        <p className="text-xs text-slate-400">
                          Snapshot cepat sebelum lanjut atau submit.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Property Terpilih
                        </p>
                        <p className="mt-2 text-base font-bold text-white">
                          {selectedListing
                            ? selectedListing.alamat_property ||
                              selectedListing.alamat_lengkap ||
                              `Property #${selectedListing.id_listing}`
                            : "Belum dipilih"}
                        </p>
                        <p className="mt-2 text-sm text-slate-400">
                          {selectedListing
                            ? `${formatCategoryLabel(
                                selectedListing.kategori
                              )} • ${formatTransactionLabel(
                                selectedListing.jenis_transaksi
                              )}`
                            : "Pilih listing terlebih dahulu"}
                        </p>
                        {form.id_listing ? (
                          <p className={`mt-3 text-sm font-bold ${theme.accentText}`}>
                            ID Property #{form.id_listing}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Nama Project
                        </p>
                        <p className="mt-2 text-base font-bold text-white">
                          {form.nama_project || "Belum diisi"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {form.deskripsi_project
                            ? form.deskripsi_project
                            : "Deskripsi belum diisi."}
                        </p>
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Struktur Nilai
                        </p>

                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Nilai Masuk</span>
                            <span className="font-bold text-white">
                              {formatCurrency(form.nilai_limit_lelang)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Balik Nama</span>
                            <span className="font-bold text-white">
                              {formatCurrency(form.biaya_balik_nama)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Eksekusi</span>
                            <span className="font-bold text-white">
                              {formatCurrency(form.biaya_eksekusi)}
                            </span>
                          </div>
                          <div className="my-2 border-t border-white/10" />
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-300">Harga Pembelian</span>
                            <span className={`font-black ${theme.accentText}`}>
                              {formatCurrency(hargaPembelianComputed)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[22px] border border-white/10 bg-black/10 p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          Estimasi
                        </p>

                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Target Pendanaan</span>
                            <span className="font-bold text-white">
                              {formatCurrency(form.target_pendanaan)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Est. Harga Jual</span>
                            <span className="font-bold text-white">
                              {formatCurrency(form.estimasi_harga_jual)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">Est. Profit</span>
                            <span className={`font-bold ${theme.accentText}`}>
                              {formatCurrency(profitComputed)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-400">ROI</span>
                            <span className={`font-bold ${theme.accentText}`}>
                              {roiPercent.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            </div>

            <div className="border-t border-white/10 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-xs leading-5 text-slate-400">
                  {step === 1 ? (
                    <>Pilih property dan lengkapi identitas project terlebih dahulu.</>
                  ) : (
                    <>Harga pembelian dan estimasi profit dihitung otomatis dari input tahap kedua.</>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={step === 1 ? onClose : handleBack}
                    className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold text-slate-200 transition ${theme.modalMutedButton} ${theme.modalMutedButtonHover}`}
                  >
                    {step === 1 ? (
                      "Batal"
                    ) : (
                      <>
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                      </>
                    )}
                  </button>

                  {step === 1 ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={!stepOneValid}
                      className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition disabled:cursor-not-allowed disabled:opacity-60 ${theme.actionButton}`}
                    >
                      Lanjut ke Nilai Property
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!canSubmit || loading}
                      className={`inline-flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-bold shadow-[0_18px_40px_rgba(0,0,0,0.22)] transition disabled:cursor-not-allowed disabled:opacity-60 ${theme.actionButton}`}
                    >
                      {loading ? "Menyimpan..." : "Simpan Project"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}