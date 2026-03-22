import { ArrowUpRight } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import { formatIDR, formatNumber, toNumber } from "./utils";
import { EmptyState, SectionCard } from "./shared";

export default function CmaCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  return (
    <SectionCard
      eyebrow="Comparable Market Analysis"
      title="CMA / pembanding pasar"
      icon={<ArrowUpRight className="h-5 w-5" />}
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
  );
}