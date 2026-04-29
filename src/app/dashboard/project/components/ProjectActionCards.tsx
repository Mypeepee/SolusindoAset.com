import Link from "next/link";

const actions = [
  {
    title: "Tambah project baru",
    description:
      "Mulai project flipper dari nol, isi nama project, target modal, estimasi exit, dan struktur investor.",
    href: "/dashboard/project/create",
    accent:
      "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    buttonClass:
      "border-emerald-400/20 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20",
    tag: "Step 01",
  },
  {
    title: "Pilih properti dari listing",
    description:
      "Konversi listing internal yang potensial menjadi kandidat project crowdfunding hanya dalam beberapa klik.",
    href: "/dashboard/listing",
    accent:
      "border-sky-400/20 bg-sky-500/10 text-sky-100",
    buttonClass:
      "border-white/10 bg-white/5 text-white hover:bg-white/10",
    tag: "Step 02",
  },
];

export default function ProjectActionCards() {
  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {actions.map((action) => (
        <article
          key={action.title}
          className={`rounded-[30px] border p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] ${action.accent}`}
        >
          <div className="flex h-full flex-col justify-between gap-6">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]">
                {action.tag}
              </div>

              <h3 className="mt-4 text-2xl font-bold tracking-tight">
                {action.title}
              </h3>

              <p className="mt-3 max-w-xl text-sm leading-7 text-white/75">
                {action.description}
              </p>
            </div>

            <Link
              href={action.href}
              className={`inline-flex w-fit items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${action.buttonClass}`}
            >
              Lanjutkan
              <span>→</span>
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}