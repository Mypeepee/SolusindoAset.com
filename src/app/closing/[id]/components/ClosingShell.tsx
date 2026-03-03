import ClosingTabs from "./ClosingTabs.client";
import type { Listing, Agent, TeamLeader } from "../page";
import Money from "./ui/Money";
import { Icon } from "@iconify/react";

function safe(s?: string | null) {
  return (s ?? "").trim();
}

function toTitleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function transaksiLabel(j: Listing["jenis_transaksi"]) {
  const map: Record<Listing["jenis_transaksi"], string> = {
    PRIMARY: "Primary",
    SECONDARY: "Secondary",
    LELANG: "Lelang",
    SEWA: "Sewa",
  };
  return map[j] ?? j;
}

function pickFirstImageUrl(gambar: any): string | null {
  const raw = safe(typeof gambar === "string" ? gambar : "");
  if (!raw) return null;

  // try JSON array: ["url1","url2"] or [{url:"..."}, ...]
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const first = parsed[0];
      if (typeof first === "string") return safe(first) || null;
      if (first && typeof first === "object" && typeof first.url === "string")
        return safe(first.url) || null;
    }
  } catch {
    // ignore
  }

  // assume raw is direct URL
  return raw;
}

export default function ClosingShell({
  listing,
  agent,
  leader,
}: {
  listing: Listing;
  agent: Agent | null;
  leader: TeamLeader | null;
}) {
  const title = safe(listing.judul) || "Detail Closing";
  const vendor = safe(listing.vendor);
  const city = safe(listing.kota) || "-";
  const jenis = transaksiLabel(listing.jenis_transaksi);

  const agentName = safe((agent as any)?.nama) || "-";
  const leaderName = safe((leader as any)?.nama) || "-";

  const priceMain = listing.harga_promo ?? listing.harga;
  const hasPromo = !!listing.harga_promo && Number(listing.harga_promo) > 0;

  const imgUrl = pickFirstImageUrl((listing as any).gambar);

  return (
    <div className="mx-auto w-full max-w-[1060px] px-4 pb-8 pt-4">
      {/* Sticky hero header */}
      <div className="sticky top-0 z-40 -mx-4 mb-4">
        <div className="relative border-b border-white/10 bg-zinc-950/70 px-4 py-4 backdrop-blur-xl">
          {/* ambient glows */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 left-[-120px] h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute -top-28 right-[-140px] h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          </div>

          {/* breadcrumbs + actions */}
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-400">
              <span className="hidden sm:inline-flex items-center gap-1">
                <Icon icon="solar:home-2-linear" className="text-sm" />
                Dashboard
              </span>
              <span className="hidden sm:inline">/</span>
              <span className="truncate">Closing</span>
              <span>/</span>
              <span className="text-zinc-200 font-semibold truncate">
                #{Number(listing.id_property)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(String(listing.id_property))}
                className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition"
              >
                <Icon icon="solar:copy-linear" className="text-base" />
                Copy ID
              </button>

              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition"
              >
                <Icon icon="solar:arrow-left-linear" className="text-base" />
                Kembali
              </a>
            </div>
          </div>

          {/* main header content */}
          <div className="relative mt-4 grid gap-4 lg:grid-cols-12">
            {/* LEFT: image + title */}
            <div className="lg:col-span-8 min-w-0">
              <div className="flex gap-4">
                {/* image */}
                <div className="relative hidden sm:block h-[92px] w-[124px] overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgUrl}
                      alt={title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.onerror = null;
                        img.src =
                          "data:image/svg+xml;charset=utf-8," +
                          encodeURIComponent(
                            `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="100%" height="100%" fill="#0b0f0e"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">No Image</text></svg>`
                          );
                      }}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-zinc-400">
                      <Icon icon="solar:gallery-linear" className="text-2xl" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/55 via-transparent to-transparent" />
                </div>

                {/* title block */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/90" />
                      Ready for Closing
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                      <Icon icon="solar:tag-linear" className="text-sm" />
                      {jenis}
                    </span>

                    {vendor ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                        <Icon icon="solar:buildings-3-linear" className="text-sm" />
                        {vendor}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-zinc-200">
                      <Icon icon="solar:map-point-linear" className="text-sm" />
                      {toTitleCase(city)}
                    </span>
                  </div>

                  <div className="mt-3 text-xl sm:text-2xl font-semibold text-white truncate">
                    {title}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-2">
                      <Icon icon="solar:user-rounded-linear" className="text-sm" />
                      Agent: <span className="text-zinc-200 font-semibold">{agentName}</span>
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="inline-flex items-center gap-2">
                      <Icon icon="solar:users-group-rounded-linear" className="text-sm" />
                      TL: <span className="text-zinc-200 font-semibold">{leaderName}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: price card */}
            <div className="lg:col-span-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-400">Harga acuan</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      <Money value={priceMain} />
                    </div>
                    {hasPromo ? (
                      <div className="mt-1 text-xs text-zinc-400">
                        Harga normal:{" "}
                        <span className="line-through">
                          <Money value={listing.harga} />
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid place-items-center rounded-2xl border border-white/10 bg-zinc-950/40 h-10 w-10 text-emerald-200">
                    <Icon icon="solar:wallet-money-linear" className="text-xl" />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
                    <div className="text-[11px] text-zinc-400">ID Property</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {Number(listing.id_property)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-3">
                    <div className="text-[11px] text-zinc-400">Kota</div>
                    <div className="mt-1 text-sm font-semibold text-white truncate">
                      {toTitleCase(city)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-zinc-500">
                  Tip: lakukan input dari kiri ke kanan—tab “Transaksi” → “Pembagian”.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ClosingTabs listing={listing} agent={agent} leader={leader} />
    </div>
  );
}