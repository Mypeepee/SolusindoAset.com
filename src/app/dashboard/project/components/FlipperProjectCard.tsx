export type FlipperProjectItem = {
  id: string;
  title: string;
  listingTitle: string;
  location: string;
  status: string;
  fundingProgress: number;
  raisedAmount: number;
  targetAmount: number;
  estimatedExitValue: number;
  estimatedROI: number;
  holdingPeriod: string;
  investors: string[];
  thumbnail: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getStatusClass(status: string) {
  const s = status.toLowerCase();

  if (s.includes("funding")) {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }

  if (s.includes("renovation")) {
    return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  }

  if (s.includes("due")) {
    return "border-sky-400/20 bg-sky-500/10 text-sky-200";
  }

  return "border-white/10 bg-white/5 text-white/80";
}

export default function FlipperProjectCard({
  project,
}: {
  project: FlipperProjectItem;
}) {
  return (
    <article className="overflow-hidden rounded-[30px] border border-white/10 bg-white/5 shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
      <div className="relative h-56 w-full overflow-hidden">
        <img
          src={project.thumbnail}
          alt={project.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111f] via-[#07111f]/30 to-transparent" />

        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur-md">
            {project.id}
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-md ${getStatusClass(
              project.status
            )}`}
          >
            {project.status}
          </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs uppercase tracking-[0.18em] text-white/60">
            Source listing
          </p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {project.title}
          </h3>
          <p className="mt-1 text-sm text-white/72">{project.listingTitle}</p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              Location
            </p>
            <p className="mt-1 text-sm font-medium text-white/90">
              {project.location}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              Holding period
            </p>
            <p className="mt-1 text-sm font-medium text-white/90">
              {project.holdingPeriod}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              Raised
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {formatCurrency(project.raisedAmount)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              Target
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {formatCurrency(project.targetAmount)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
              Est. ROI
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-200">
              {project.estimatedROI}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Funding progress</span>
            <span className="font-semibold text-white">
              {project.fundingProgress}%
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{
                width: `${Math.max(0, Math.min(project.fundingProgress, 100))}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b1526] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                Estimated exit value
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {formatCurrency(project.estimatedExitValue)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                Investors
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {project.investors.length} orang
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            Investor preview
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {project.investors.map((name) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/78"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20">
            Lihat Detail
          </button>

          <button className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            Manage Funding
          </button>
        </div>
      </div>
    </article>
  );
}