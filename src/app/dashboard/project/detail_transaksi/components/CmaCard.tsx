import { ArrowUpRight } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { formatIDR, formatNumber, safeDivide, toNumber } from "./utils";
import { EmptyState, SectionCard } from "./shared";

type CmaRow = {
  id: string;
  kind: "subject" | "comparable";
  name: string;
  landArea: number;
  price: number;
  pricePerMeter: number;
};

function pickNumber(source: unknown, keys: string[]) {
  if (!source || typeof source !== "object") return 0;
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value > 0) return value;
  }

  return 0;
}

function formatArea(value: number) {
  return value > 0 ? `${formatNumber(value)} m²` : "—";
}

function getHeatColor(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || value <= 0) return "#94a3b8";

  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return "#6ee7b7";
  }

  const ratio = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const hue = 145 - ratio * 145;
  const saturation = 78;
  const lightness = 66 - ratio * 8;

  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function CompactMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-[13px] tabular-nums sm:text-sm"
        style={{ color: color ?? "#f8fafc" }}
      >
        {value}
      </div>
    </div>
  );
}

export default function CmaCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const subjectLandArea = pickNumber(project, [
    "landArea",
    "luasTanah",
    "assetLandArea",
    "propertyLandArea",
    "luas_tanah",
  ]);

  const subjectPrice = pickNumber(project, [
    "fundingTarget",
    "target_pendanaan",
    "targetPendanaan",
    "purchasePrice",
    "hargaBeli",
    "acquisitionPrice",
    "harga_beli",
    "auctionLimitValue",
  ]);

  const subjectPricePerMeter = safeDivide(subjectPrice, subjectLandArea);

  const comparableRows: CmaRow[] = project.cma.map((item, index) => {
    const landArea = toNumber(item.landArea);
    const price = toNumber(item.price);
    const pricePerMeter = safeDivide(price, landArea);

    return {
      id: String(item.id ?? `cma-${index}`),
      kind: "comparable",
      name: `CMA ${String(index + 1).padStart(2, "0")}`,
      landArea,
      price,
      pricePerMeter,
    };
  });

  const subjectRow: CmaRow | null =
    subjectLandArea > 0 || subjectPrice > 0
      ? {
          id: "subject-property",
          kind: "subject",
          name: "Asset Ini",
          landArea: subjectLandArea,
          price: subjectPrice,
          pricePerMeter: subjectPricePerMeter,
        }
      : null;

  const rows = [...comparableRows, ...(subjectRow ? [subjectRow] : [])]
    .filter((item) => item.landArea > 0 || item.price > 0 || item.pricePerMeter > 0)
    .sort((a, b) => {
      const left = itemValueOrInfinity(a.pricePerMeter);
      const right = itemValueOrInfinity(b.pricePerMeter);
      return left - right;
    });

  const validPricePerMeter = rows
    .map((item) => item.pricePerMeter)
    .filter((value) => Number.isFinite(value) && value > 0);

  const minPricePerMeter =
    validPricePerMeter.length > 0 ? Math.min(...validPricePerMeter) : 0;
  const maxPricePerMeter =
    validPricePerMeter.length > 0 ? Math.max(...validPricePerMeter) : 0;

  if (rows.length === 0) {
    return (
      <SectionCard
        eyebrow="Comparable Market Analysis"
        title="CMA / pembanding pasar"
        icon={<ArrowUpRight className="h-5 w-5" />}
      >
        <EmptyState text="Belum ada data CMA. Investor butuh anchor harga yang objektif untuk membaca posisi aset terhadap market." />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      eyebrow="Comparable Market Analysis"
      title="CMA / pembanding pasar"
      icon={<ArrowUpRight className="h-5 w-5" />}
      right={
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
          {project.cma.length} pembanding
        </span>
      }
    >
      <div className="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(215,181,109,0.05),transparent_18%),radial-gradient(circle_at_top_right,rgba(110,138,168,0.04),transparent_18%),linear-gradient(180deg,#0b1017_0%,#080d14_100%)] p-3 sm:p-4">
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#091018]/92">
          <div className="hidden border-b border-white/8 bg-white/[0.04] px-4 py-2.5 md:grid md:grid-cols-[minmax(140px,1.35fr)_72px_minmax(170px,0.92fr)_minmax(185px,1fr)] md:gap-x-3 text-[10px] uppercase tracking-[0.22em] text-slate-500">
            <div className="whitespace-nowrap">Nama aset</div>
            <div className="whitespace-nowrap">LT</div>
            <div className="whitespace-nowrap pl-1">Harga</div>
            <div className="whitespace-nowrap pl-4">Harga / meter</div>
          </div>

          <div className="divide-y divide-white/8">
            {rows.map((item) => {
              const isSubject = item.kind === "subject";
              const meterColor = getHeatColor(
                item.pricePerMeter,
                minPricePerMeter,
                maxPricePerMeter
              );

              return (
                <div
                  key={item.id}
                  className={
                    isSubject
                      ? "bg-[linear-gradient(90deg,rgba(215,181,109,0.09),rgba(215,181,109,0.03)_34%,rgba(255,255,255,0.012)_100%)]"
                      : "hover:bg-white/[0.018]"
                  }
                >
                  <div className="hidden px-4 py-3 md:grid md:grid-cols-[minmax(140px,1.35fr)_72px_minmax(170px,0.92fr)_minmax(185px,1fr)] md:gap-x-3 text-[15px] leading-none">
                    <div className="min-w-0 flex items-center gap-2">
                      <span
                        className={[
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          isSubject ? "bg-[#d7b56d]" : "bg-slate-500",
                        ].join(" ")}
                      />
                      <span
                        className={[
                          "whitespace-nowrap",
                          isSubject
                            ? "font-semibold text-white"
                            : "font-medium text-slate-100",
                        ].join(" ")}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div
                      className={[
                        "flex items-center whitespace-nowrap",
                        isSubject ? "text-white" : "text-slate-200",
                      ].join(" ")}
                    >
                      {formatArea(item.landArea)}
                    </div>

                    <div
                      className={[
                        "flex items-center pl-1 font-mono tabular-nums whitespace-nowrap",
                        isSubject ? "text-white" : "text-slate-100",
                      ].join(" ")}
                    >
                      {item.price > 0 ? formatIDR(item.price) : "—"}
                    </div>

                    <div
                      className="flex items-center pl-4 font-mono tabular-nums whitespace-nowrap"
                      style={{ color: item.pricePerMeter > 0 ? meterColor : "#94a3b8" }}
                    >
                      {item.pricePerMeter > 0 ? formatIDR(item.pricePerMeter) : "—"}
                    </div>
                  </div>

                  <div className="px-3 py-3 md:hidden">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={[
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          isSubject ? "bg-[#d7b56d]" : "bg-slate-500",
                        ].join(" ")}
                      />
                      <span
                        className={isSubject ? "font-semibold text-white" : "text-slate-100"}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <CompactMetric label="LT" value={formatArea(item.landArea)} />
                      <CompactMetric
                        label="Harga / meter"
                        value={item.pricePerMeter > 0 ? formatIDR(item.pricePerMeter) : "—"}
                        color={item.pricePerMeter > 0 ? meterColor : "#94a3b8"}
                      />
                      <CompactMetric
                        label="Harga"
                        value={item.price > 0 ? formatIDR(item.price) : "—"}
                      />
                      <CompactMetric
                        label="Status"
                        value={isSubject ? "Asset Ini" : "CMA"}
                        color={isSubject ? "#f0ddb7" : "#cbd5e1"}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function itemValueOrInfinity(value: number) {
  return value > 0 ? value : Number.POSITIVE_INFINITY;
}