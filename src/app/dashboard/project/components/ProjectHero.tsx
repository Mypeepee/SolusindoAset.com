import Link from "next/link";

export default function ProjectHero() {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.22),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_26%),linear-gradient(135deg,#0f172a_0%,#08101d_100%)] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)] sm:p-8 lg:p-10">
      <div className="absolute inset-y-0 right-[-100px] hidden w-[360px] rounded-full bg-emerald-400/10 blur-3xl lg:block" />
      <div className="absolute bottom-[-80px] left-[30%] hidden h-[220px] w-[220px] rounded-full bg-sky-400/10 blur-3xl lg:block" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
            Flipper Project Workspace
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Crowdfunding properti untuk project flip yang lebih rapi, cepat,
            dan meyakinkan.
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 sm:text-[15px]">
            Kelola alur project mulai dari memilih properti dari listing,
            membuat struktur project, mengatur komposisi pendanaan, hingga
            memonitor progress flip dalam satu dashboard yang clean dan modern.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
          <Link
            href="/dashboard/project/create"
            className="group inline-flex min-h-[64px] items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-5 py-4 text-left transition hover:border-emerald-300/30 hover:bg-emerald-500/20"
          >
            <div>
              <p className="text-sm font-semibold text-emerald-100">
                Tambah Project
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-100/70">
                Buat project crowdfunding baru
              </p>
            </div>
            <span className="text-lg text-emerald-200 transition group-hover:translate-x-0.5">
              +
            </span>
          </Link>

          <Link
            href="/dashboard/listing"
            className="group inline-flex min-h-[64px] items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:border-white/20 hover:bg-white/8"
          >
            <div>
              <p className="text-sm font-semibold text-white">
                Pilih dari Listing
              </p>
              <p className="mt-1 text-xs leading-5 text-white/65">
                Gunakan properti dari tabel listing
              </p>
            </div>
            <span className="text-lg text-white/70 transition group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}