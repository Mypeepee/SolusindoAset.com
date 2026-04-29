"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Gauge,
  Landmark,
  Layers3,
  MapPin,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users2,
} from "lucide-react";

type FundingType = "terbuka" | "tertutup";

type ProjectStatus =
  | "pendanaan_terbuka"
  | "pendanaan_penuh"
  | "pengurusan_dokumen"
  | "eksekusi_pengosongan"
  | "renovasi"
  | "sedang_dijual"
  | "terjual"
  | "dibatalkan";

type PaymentStatus =
  | "menunggu_pembayaran"
  | "dibayar_sebagian"
  | "lunas"
  | "dikembalikan"
  | "dibatalkan";

type NullableDate = string | Date | null | undefined;

export type ProjectInvestorViewModel = {
  id: string;
  name: string;
  avatar?: string | null;
  committed: number | string;
  paid: number | string;
  ownership?: number | string | null;
  status: PaymentStatus;
  note?: string | null;
};

export type ProjectCmaViewModel = {
  id: string | number;
  name: string;
  landArea: number | string;
  price: number | string;
  note?: string | null;
};

export type ProjectDetailViewModel = {
  id: string;
  listingId?: string | number;
  name: string;
  address?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  village?: string | null;
  image?: string | null;
  purchaseDate?: NullableDate;

  purchasePrice: number | string;
  estimatedSellPrice: number | string;
  estimatedNetProfit: number | string;
  fundingTarget: number | string;
  totalFunded: number | string;

  fundingType: FundingType;
  status: ProjectStatus;

  startDate?: NullableDate;
  estimatedFinish?: NullableDate;
  estimatedMonths?: number | string | null;
  fundingClosedAt?: NullableDate;

  description?: string | null;

  createdById?: string;
  createdByName?: string | null;

  auctionLimitValue?: number | string;
  spareBidding?: number | string;
  executionCost?: number | string;
  renovationCost?: number | string;
  transferCost?: number | string;
  totalAcquisitionCost?: number | string;
  reserveFund?: number | string;

  createdAt?: NullableDate;
  updatedAt?: NullableDate;

  investors: ProjectInvestorViewModel[];
  cma: ProjectCmaViewModel[];
};

const STATUS_ORDER: ProjectStatus[] = [
  "pendanaan_terbuka",
  "pendanaan_penuh",
  "pengurusan_dokumen",
  "eksekusi_pengosongan",
  "renovasi",
  "sedang_dijual",
  "terjual",
];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  pendanaan_terbuka: "Pendanaan dibuka",
  pendanaan_penuh: "Pendanaan penuh",
  pengurusan_dokumen: "Pengurusan dokumen",
  eksekusi_pengosongan: "Eksekusi pengosongan",
  renovasi: "Renovasi",
  sedang_dijual: "Sedang dijual",
  terjual: "Terjual",
  dibatalkan: "Dibatalkan",
};

export default function ProjectTransactionDetailPage({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const purchasePrice = toNumber(project.purchasePrice);
  const estimatedSellPrice = toNumber(project.estimatedSellPrice);
  const estimatedNetProfit = toNumber(project.estimatedNetProfit);
  const fundingTarget = toNumber(project.fundingTarget);
  const totalFunded = toNumber(project.totalFunded);

  const auctionLimitValue = toNumber(project.auctionLimitValue);
  const spareBidding = toNumber(project.spareBidding);
  const executionCost = toNumber(project.executionCost);
  const renovationCost = toNumber(project.renovationCost);
  const transferCost = toNumber(project.transferCost);
  const totalAcquisitionCost = toNumber(project.totalAcquisitionCost);
  const reserveFund = toNumber(project.reserveFund);

  const fundingProgress = safeDivide(totalFunded, fundingTarget);
  const remainingFunding = Math.max(0, fundingTarget - totalFunded);
  const roi = safeDivide(estimatedNetProfit, fundingTarget);
  const multiple = fundingTarget > 0 ? (fundingTarget + estimatedNetProfit) / fundingTarget : 0;
  const exitSpread = estimatedSellPrice - totalAcquisitionCost;
  const profitMargin = safeDivide(estimatedNetProfit, estimatedSellPrice);
  const opsLoad = safeDivide(
    executionCost + renovationCost + transferCost + reserveFund,
    fundingTarget
  );

  const investors = [...project.investors].sort(
    (a, b) => toNumber(b.paid) - toNumber(a.paid)
  );

  const totalCommitted = investors.reduce((sum, item) => sum + toNumber(item.committed), 0);
  const totalPaid = investors.reduce((sum, item) => sum + toNumber(item.paid), 0);
  const paidCommitmentProgress = safeDivide(totalPaid, totalCommitted);
  const ownershipAllocated = investors.reduce(
    (sum, item) => sum + toNumber(item.ownership),
    0
  );
  const fullyPaidCount = investors.filter((item) => item.status === "lunas").length;

  const avgCmaPrice =
    project.cma.length > 0
      ? project.cma.reduce((sum, item) => sum + toNumber(item.price), 0) / project.cma.length
      : 0;

  const impliedBuyVsCma =
    avgCmaPrice > 0 ? 1 - purchasePrice / avgCmaPrice : 0;

  const heroImage = normalizeImage(project.image);
  const currentStepIndex = STATUS_ORDER.indexOf(project.status);
  const locationFull = [project.village, project.district, project.city, project.province]
    .filter(Boolean)
    .join(", ");

  const capitalStack = [
    { label: "Nilai limit lelang", value: auctionLimitValue },
    { label: "Spare bidding", value: spareBidding },
    { label: "Biaya eksekusi", value: executionCost },
    { label: "Biaya renovasi", value: renovationCost },
    { label: "Biaya balik nama", value: transferCost },
    { label: "Dana cadangan", value: reserveFund },
    { label: "Total biaya akuisisi", value: totalAcquisitionCost, strong: true },
  ].filter((item) => item.value > 0);

  const riskNotes = buildRiskNotes({
    fundingProgress,
    opsLoad,
    fundingType: project.fundingType,
    cmaCount: project.cma.length,
    status: project.status,
    remainingFunding,
    totalAcquisitionCost,
    fundingTarget,
  });

  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <div className="space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="font-mono uppercase tracking-[0.28em] text-slate-500">
              Property Deal Room
            </span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <span className="font-mono text-white">{project.id}</span>
            <span className="h-1 w-1 rounded-full bg-slate-500" />
            <ProjectStatusPill status={project.status} />
            <FundingTypePill type={project.fundingType} />
            {project.city ? (
              <>
                <span className="h-1 w-1 rounded-full bg-slate-500" />
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {project.city}
                </span>
              </>
            ) : null}
            <span className="ml-auto text-slate-500">
              Updated {formatDate(project.updatedAt)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[#0c1119] shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
              {heroImage ? (
                <img
                  src={heroImage}
                  alt={project.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-55"
                />
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_30%),linear-gradient(135deg,#0c1119,#0a0d13)]" />
              )}

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,11,0.1)_0%,rgba(5,7,11,0.55)_42%,rgba(5,7,11,0.95)_100%)]" />

              <div className="relative flex min-h-[470px] flex-col justify-between p-7 md:p-9">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-[11px] font-medium text-amber-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Bloomberg-grade investor detail
                  </div>
                  {project.createdByName || project.createdById ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] text-slate-200">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      Managed by {project.createdByName ?? project.createdById}
                    </div>
                  ) : null}
                </div>

                <div className="max-w-4xl">
                  <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.34em] text-slate-400">
                    Asset acquisition / property crowdfunding
                  </p>

                  <h1 className="max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
                    {project.name}
                  </h1>

                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200/85 md:text-[15px]">
                    {project.description?.trim()
                      ? project.description
                      : "Struktur page ini dirancang agar investor memahami deal economics, kualitas pricing, deployment dana, kesiapan eksekusi, dan jalur exit hanya dalam satu layar."}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-300">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {project.address || locationFull || "Lokasi belum diisi"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      Akuisisi {formatDate(project.purchaseDate)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      Estimasi tenor {project.estimatedMonths ? `${project.estimatedMonths} bulan` : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <HeroStat
                    label="Dana masuk"
                    value={compactIDR(totalFunded)}
                    helper={`${formatPercent(fundingProgress)} dari target`}
                  />
                  <HeroStat
                    label="Target pendanaan"
                    value={compactIDR(fundingTarget)}
                    helper={remainingFunding > 0 ? `Sisa ${compactIDR(remainingFunding)}` : "Target terpenuhi"}
                  />
                  <HeroStat
                    label="Potensi ROI"
                    value={formatPercent(roi)}
                    helper={`${formatMultiple(multiple)} equity multiple`}
                  />
                  <HeroStat
                    label="Estimasi profit"
                    value={compactIDR(estimatedNetProfit)}
                    helper={`Exit ${compactIDR(estimatedSellPrice)}`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-4">
            <div className="rounded-[34px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-slate-500">
                    Investment Snapshot
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    Ringkas, padat, dan investor-first
                  </h2>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-300">
                  <Gauge className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <MetricTile
                  label="Funding progress"
                  value={formatPercent(fundingProgress)}
                  helper={`${compactIDR(totalFunded)} / ${compactIDR(fundingTarget)}`}
                />
                <ProgressBar value={fundingProgress} />

                <div className="grid grid-cols-2 gap-3">
                  <MetricTile
                    label="Remaining room"
                    value={compactIDR(remainingFunding)}
                    helper="Kapasitas pendanaan tersisa"
                  />
                  <MetricTile
                    label="Paid commitments"
                    value={formatPercent(paidCommitmentProgress)}
                    helper={`${compactIDR(totalPaid)} paid`}
                  />
                  <MetricTile
                    label="Allocated equity"
                    value={formatPercent(ownershipAllocated)}
                    helper={`${investors.length} investor`}
                  />
                  <MetricTile
                    label="Fully paid investors"
                    value={String(fullyPaidCount)}
                    helper="Investor dengan status lunas"
                  />
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[#0a0e14] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Exit value</span>
                    <span className="font-mono text-white">
                      {formatIDR(estimatedSellPrice)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Acquisition basis</span>
                    <span className="font-mono text-white">
                      {formatIDR(totalAcquisitionCost || purchasePrice)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-400">Net profit</span>
                    <span className="font-mono text-emerald-300">
                      {formatIDR(estimatedNetProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <RibbonStat
            icon={Landmark}
            label="Harga pembelian"
            value={formatIDR(purchasePrice)}
            helper="Basis akuisisi awal"
          />
          <RibbonStat
            icon={CircleDollarSign}
            label="Total biaya akuisisi"
            value={formatIDR(totalAcquisitionCost || purchasePrice)}
            helper="All-in capital basis"
          />
          <RibbonStat
            icon={TrendingUp}
            label="Exit spread"
            value={formatIDR(exitSpread)}
            helper="Exit value - acquisition basis"
            accent="emerald"
          />
          <RibbonStat
            icon={Users2}
            label="Investor book"
            value={`${investors.length} investor`}
            helper={`${compactIDR(totalCommitted)} committed`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <SectionCard
              icon={Sparkles}
              eyebrow="Executive brief"
              title="Apa yang perlu investor pahami dalam 60 detik"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <InsightCard
                  title="Pricing edge"
                  value={
                    avgCmaPrice > 0
                      ? formatPercent(impliedBuyVsCma)
                      : "—"
                  }
                  helper={
                    avgCmaPrice > 0
                      ? `vs rata-rata CMA ${compactIDR(avgCmaPrice)}`
                      : "CMA belum cukup untuk hitung edge"
                  }
                />
                <InsightCard
                  title="Execution load"
                  value={formatPercent(opsLoad)}
                  helper="Porsi biaya operasional terhadap target"
                />
                <InsightCard
                  title="Profit margin"
                  value={formatPercent(profitMargin)}
                  helper="Laba bersih terhadap estimasi harga jual"
                />
              </div>

              <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.025] p-5">
                <p className="text-sm leading-7 text-slate-300">
                  Deal ini ditampilkan seperti produk investasi premium:
                  investor langsung melihat{" "}
                  <span className="font-semibold text-white">harga masuk</span>,{" "}
                  <span className="font-semibold text-white">basis biaya total</span>,{" "}
                  <span className="font-semibold text-white">skenario exit</span>,{" "}
                  <span className="font-semibold text-white">daya serap pendanaan</span>, dan{" "}
                  <span className="font-semibold text-white">kualitas komparabel pasar</span>.
                  Ini membuat keputusan investasi terasa jauh lebih percaya diri, bukan sekadar melihat foto properti dan angka target.
                </p>
              </div>
            </SectionCard>

            <SectionCard
              icon={Layers3}
              eyebrow="Capital deployment"
              title="Kemana dana investor dialokasikan"
              right={
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                  Target {formatIDR(fundingTarget)}
                </span>
              }
            >
              <div className="space-y-3">
                {capitalStack.length > 0 ? (
                  capitalStack.map((item) => (
                    <AllocationRow
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      ratio={safeDivide(item.value, fundingTarget)}
                      strong={item.strong}
                    />
                  ))
                ) : (
                  <EmptyState text="Komponen capital stack belum diisi, jadi investor belum bisa melihat deployment dana secara lengkap." />
                )}
              </div>
            </SectionCard>

            <SectionCard
              icon={ArrowUpRight}
              eyebrow="Comparable market analysis"
              title="CMA / pembanding pasar"
              right={
                project.cma.length > 0 ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                    {project.cma.length} pembanding
                  </span>
                ) : null
              }
            >
              {project.cma.length > 0 ? (
                <div className="overflow-hidden rounded-[24px] border border-white/10">
                  <div className="grid grid-cols-[1.7fr_0.8fr_1fr_1.1fr] gap-4 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                    <div>Nama aset</div>
                    <div>Luas tanah</div>
                    <div>Harga</div>
                    <div>Harga / m²</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {project.cma.map((item) => {
                      const landArea = toNumber(item.landArea);
                      const price = toNumber(item.price);
                      const pricePerMeter = landArea > 0 ? price / landArea : 0;

                      return (
                        <div
                          key={String(item.id)}
                          className="grid grid-cols-[1.7fr_0.8fr_1fr_1.1fr] gap-4 px-4 py-4 text-sm text-slate-200"
                        >
                          <div>
                            <div className="font-medium text-white">{item.name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.note || "Pembanding pasar"}
                            </div>
                          </div>
                          <div>{landArea > 0 ? `${formatNumber(landArea)} m²` : "—"}</div>
                          <div className="font-mono">{formatIDR(price)}</div>
                          <div className="font-mono text-emerald-300">
                            {pricePerMeter > 0 ? formatIDR(pricePerMeter) : "—"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState text="Belum ada data CMA. Untuk page premium seperti ini, CMA sangat penting karena investor butuh anchor harga yang objektif." />
              )}
            </SectionCard>

            <SectionCard
              icon={Users2}
              eyebrow="Investor book"
              title="Partisipasi investor dan kualitas pembayaran"
              right={
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                  {investors.length} investor terdaftar
                </span>
              }
            >
              {investors.length > 0 ? (
                <div className="overflow-hidden rounded-[24px] border border-white/10">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.9fr] gap-4 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                    <div>Investor</div>
                    <div>Komitmen</div>
                    <div>Terbayar</div>
                    <div>Kepemilikan</div>
                    <div>Status</div>
                  </div>

                  <div className="divide-y divide-white/10">
                    {investors.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.9fr] gap-4 px-4 py-4 text-sm text-slate-200"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <InvestorAvatar name={item.name} avatar={item.avatar} />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-white">{item.name}</div>
                              <div className="truncate text-xs text-slate-500">
                                {item.note || "Investor tercatat di project"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="font-mono">{formatIDR(toNumber(item.committed))}</div>
                        <div className="font-mono text-emerald-300">{formatIDR(toNumber(item.paid))}</div>
                        <div>{item.ownership != null ? formatPercent(toNumber(item.ownership)) : "—"}</div>
                        <div>
                          <PaymentStatusPill status={item.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState text="Belum ada investor pada project ini." />
              )}
            </SectionCard>
          </div>

          <div className="space-y-6 xl:col-span-4">
            <div className="xl:sticky xl:top-6 xl:space-y-6">
              <SectionCard
                icon={TrendingUp}
                eyebrow="Return framework"
                title="Model hasil investasi"
              >
                <DataRow
                  label="Target pendanaan"
                  value={formatIDR(fundingTarget)}
                />
                <DataRow
                  label="Total biaya akuisisi"
                  value={formatIDR(totalAcquisitionCost || purchasePrice)}
                />
                <DataRow
                  label="Estimasi harga jual"
                  value={formatIDR(estimatedSellPrice)}
                />
                <DataRow
                  label="Estimasi profit bersih"
                  value={formatIDR(estimatedNetProfit)}
                  valueClassName="text-emerald-300"
                />
                <div className="my-4 border-t border-white/10" />
                <DataRow
                  label="ROI terhadap dana investor"
                  value={formatPercent(roi)}
                  valueClassName="text-white"
                />
                <DataRow
                  label="Equity multiple"
                  value={formatMultiple(multiple)}
                />
                <DataRow
                  label="Profit margin"
                  value={formatPercent(profitMargin)}
                />
              </SectionCard>

              <SectionCard
                icon={CalendarDays}
                eyebrow="Lifecycle"
                title="Status eksekusi project"
              >
                <div className="space-y-4">
                  {STATUS_ORDER.map((status, index) => {
                    const isDone = currentStepIndex >= 0 && index < currentStepIndex;
                    const isActive = status === project.status;
                    const isFuture = currentStepIndex >= 0 && index > currentStepIndex;

                    return (
                      <div key={status} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={[
                              "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border text-xs",
                              isActive
                                ? "border-amber-400/40 bg-amber-400/12 text-amber-200"
                                : isDone
                                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                                : "border-white/10 bg-white/[0.03] text-slate-500",
                            ].join(" ")}
                          >
                            {isDone ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                          </div>

                          {index !== STATUS_ORDER.length - 1 ? (
                            <div className="mt-2 h-8 w-px bg-white/10" />
                          ) : null}
                        </div>

                        <div className="min-w-0 pb-3">
                          <div className="font-medium text-white">{STATUS_LABEL[status]}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {isActive
                              ? "Fase aktif saat ini"
                              : isDone
                              ? "Tahapan telah terlewati"
                              : isFuture
                              ? "Tahapan berikutnya"
                              : "—"}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {project.status === "dibatalkan" ? (
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                      Project berstatus dibatalkan. Pastikan seluruh komunikasi investor dan penanganan dana terdokumentasi dengan sangat jelas.
                    </div>
                  ) : null}
                </div>
              </SectionCard>

              <SectionCard
                icon={ShieldAlert}
                eyebrow="Risk monitor"
                title="Catatan yang perlu dibaca investor"
              >
                <div className="space-y-3">
                  {riskNotes.map((note, index) => (
                    <div
                      key={`${note}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-slate-300"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                icon={MapPin}
                eyebrow="Asset facts"
                title="Data dasar aset"
              >
                <DataRow label="ID project" value={project.id} />
                <DataRow label="ID listing" value={String(project.listingId ?? "—")} />
                <DataRow label="Jenis pendanaan" value={capitalize(project.fundingType)} />
                <DataRow label="Tanggal pembelian" value={formatDate(project.purchaseDate)} />
                <DataRow label="Mulai project" value={formatDate(project.startDate)} />
                <DataRow label="Estimasi selesai" value={formatDate(project.estimatedFinish)} />
                <DataRow label="Pendanaan ditutup" value={formatDate(project.fundingClosedAt)} />
                <DataRow label="Wilayah" value={locationFull || "—"} />
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  eyebrow,
  title,
  right,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5 text-slate-300">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
              {eyebrow}
            </p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
              {title}
            </h3>
          </div>
        </div>
        {right}
      </div>

      {children}
    </section>
  );
}

function HeroStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-4 backdrop-blur-md">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-white md:text-xl">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function RibbonStat({
  icon: Icon,
  label,
  value,
  helper,
  accent = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  accent?: "default" | "emerald";
}) {
  const accentClass =
    accent === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : "border-white/10 bg-white/[0.04] text-slate-300";

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-white">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{helper}</div>
        </div>
        <div className={`rounded-2xl border p-2.5 ${accentClass}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0f16] p-4">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[#0a0f16] p-5">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{title}</div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function AllocationRow({
  label,
  value,
  ratio,
  strong,
}: {
  label: string;
  value: number;
  ratio: number;
  strong?: boolean;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0a0e14] px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className={strong ? "font-semibold text-white" : "text-slate-300"}>{label}</div>
        <div className="text-right">
          <div className={`font-mono ${strong ? "text-white" : "text-slate-200"}`}>
            {formatIDR(value)}
          </div>
          <div className="text-xs text-slate-500">{formatPercent(ratio)} dari target</div>
        </div>
      </div>
      <ProgressBar value={ratio} />
    </div>
  );
}

function DataRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`text-right font-mono text-white ${valueClassName || ""}`}>
        {value}
      </span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value * 100));

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(245,158,11,0.95),rgba(16,185,129,0.95))]"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm leading-6 text-slate-400">
      {text}
    </div>
  );
}

function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  const tone =
    status === "terjual"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
      : status === "dibatalkan"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
      : status === "sedang_dijual"
      ? "border-sky-400/25 bg-sky-400/10 text-sky-300"
      : "border-amber-400/25 bg-amber-400/10 text-amber-200";

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function FundingTypePill({ type }: { type: FundingType }) {
  const tone =
    type === "terbuka"
      ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-300"
      : "border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${tone}`}>
      Pendanaan {capitalize(type)}
    </span>
  );
}

function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const toneMap: Record<PaymentStatus, string> = {
    menunggu_pembayaran: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    dibayar_sebagian: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    lunas: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    dikembalikan: "border-slate-400/25 bg-slate-400/10 text-slate-300",
    dibatalkan: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  };

  const labelMap: Record<PaymentStatus, string> = {
    menunggu_pembayaran: "Menunggu",
    dibayar_sebagian: "Sebagian",
    lunas: "Lunas",
    dikembalikan: "Dikembalikan",
    dibatalkan: "Dibatalkan",
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneMap[status]}`}>
      {labelMap[status]}
    </span>
  );
}

function InvestorAvatar({
  name,
  avatar,
}: {
  name: string;
  avatar?: string | null;
}) {
  const src = normalizeImage(avatar);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-10 w-10 rounded-2xl border border-white/10 object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-sm font-semibold text-slate-200">
      {getInitials(name)}
    </div>
  );
}

function buildRiskNotes({
  fundingProgress,
  opsLoad,
  fundingType,
  cmaCount,
  status,
  remainingFunding,
  totalAcquisitionCost,
  fundingTarget,
}: {
  fundingProgress: number;
  opsLoad: number;
  fundingType: FundingType;
  cmaCount: number;
  status: ProjectStatus;
  remainingFunding: number;
  totalAcquisitionCost: number;
  fundingTarget: number;
}) {
  const notes: string[] = [];

  if (fundingType === "tertutup") {
    notes.push(
      "Skema pendanaan tertutup biasanya menciptakan eksklusivitas, tetapi transparansi komunikasi investor harus lebih disiplin karena basis partisipannya lebih sempit."
    );
  } else {
    notes.push(
      "Skema pendanaan terbuka cocok untuk membangun kepercayaan publik, sehingga page seperti ini harus sangat kuat di data, bukan hanya visual."
    );
  }

  if (fundingProgress < 0.5 && status === "pendanaan_terbuka") {
    notes.push(
      `Serapan pendanaan baru ${formatPercent(
        fundingProgress
      )}. Investor baru akan melihat ini sebagai sinyal momentum, jadi narasi pricing dan deployment wajib sangat jelas.`
    );
  }

  if (remainingFunding > 0 && status !== "dibatalkan") {
    notes.push(
      `Masih ada kapasitas dana ${compactIDR(
        remainingFunding
      )}. Ini penting untuk menunjukkan room partisipasi yang masih tersedia.`
    );
  }

  if (opsLoad > 0.2) {
    notes.push(
      `Porsi biaya operasional terhadap target berada di ${formatPercent(
        opsLoad
      )}. Beban eksekusi yang besar harus diberi justifikasi yang sangat rapi agar investor tetap nyaman.`
    );
  }

  if (cmaCount < 3) {
    notes.push(
      "Jumlah CMA masih terbatas. Untuk aset seperti ini, semakin kuat pembanding pasar, semakin kredibel harga masuk dan skenario exit di mata investor."
    );
  }

  if (fundingTarget > 0 && totalAcquisitionCost > fundingTarget) {
    notes.push(
      "Total biaya akuisisi berada di atas target pendanaan. Investor akan langsung mempertanyakan sumber penutup selisih dana dan struktur mitigasinya."
    );
  }

  if (notes.length === 0) {
    notes.push(
      "Secara struktur, deal terlihat sehat. Tingkatkan lagi dengan menambahkan dokumen pendukung, legal milestones, dan pembanding pasar yang lebih banyak."
    );
  }

  return notes.slice(0, 4);
}

function normalizeImage(value?: string | null) {
  if (!value) return null;

  const trimmed = value.trim();

  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w1600`;
  }

  const match = trimmed.match(/(?:id=|\/d\/)([A-Za-z0-9_-]{20,})/);
  if (match?.[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
  }

  return trimmed;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function safeDivide(a: number, b: number) {
  if (!b) return 0;
  return a / b;
}

function formatIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function compactIDR(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMultiple(value: number) {
  return value > 0 ? `${value.toFixed(2)}x` : "—";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: NullableDate) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}