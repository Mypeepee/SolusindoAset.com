import { Users2 } from "lucide-react";
import type { ProjectDetailViewModel } from "./types";
import {
  formatIDR,
  formatPercent,
  getInitials,
  normalizeImage,
  toNumber,
} from "./utils";
import { EmptyState, PaymentStatusPill, SectionCard } from "./shared";

function normalizeOwnership(value: unknown) {
  const numeric = toNumber(value);
  if (!numeric) return null;

  return numeric > 1 ? numeric / 100 : numeric;
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
          className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-lg font-semibold text-white">
          {getInitials(displayName)}
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold text-white">
          {displayName}
        </div>
        {helper ? (
          <div className="truncate text-xs text-slate-500">{helper}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function InvestorBookCard({
  project,
}: {
  project: ProjectDetailViewModel;
}) {
  const investors = [...project.investors].sort(
    (a, b) => toNumber(b.committed) - toNumber(a.committed)
  );

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
      {investors.length > 0 ? (
        <div className="overflow-hidden rounded-[24px] border border-white/10">
          <div className="grid grid-cols-[minmax(0,1.7fr)_1.05fr_1fr_0.95fr_0.9fr] gap-4 bg-white/[0.04] px-5 py-3 text-xs uppercase tracking-[0.22em] text-slate-500">
            <div>Investor</div>
            <div>Komitmen</div>
            <div>Terbayar</div>
            <div>Kepemilikan</div>
            <div>Status</div>
          </div>

          <div className="divide-y divide-white/10">
            {investors.map((item) => {
              const ownership = normalizeOwnership(item.ownership);

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1.7fr)_1.05fr_1fr_0.95fr_0.9fr] gap-4 px-5 py-5 text-sm text-slate-200"
                >
                  <div className="min-w-0">
                    <InvestorIdentity
                      name={item.name}
                      avatar={item.avatar}
                      note={item.note}
                    />
                  </div>

                  <div className="font-mono text-white">
                    {formatIDR(toNumber(item.committed))}
                  </div>

                  <div className="font-mono text-emerald-300">
                    {formatIDR(toNumber(item.paid))}
                  </div>

                  <div className="text-white">
                    {ownership != null ? formatPercent(ownership) : "—"}
                  </div>

                  <div>
                    <PaymentStatusPill status={item.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState text="Belum ada investor pada project ini." />
      )}
    </SectionCard>
  );
}