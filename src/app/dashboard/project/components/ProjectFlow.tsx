const steps = [
  {
    step: "01",
    title: "Pilih properti yang layak di-flip",
    description:
      "Ambil properti dari tabel listing internal, lalu review harga akuisisi, potensi renovasi, dan estimasi harga jual.",
  },
  {
    step: "02",
    title: "Susun project & struktur pendanaan",
    description:
      "Buat project crowdfunding, tentukan target modal, komposisi saham investor, dan strategi funding.",
  },
  {
    step: "03",
    title: "Track expense, progress, dan exit",
    description:
      "Pantau renovasi, biaya berjalan, status funding, hingga proses jual kembali untuk menghitung profit final.",
  },
];

export default function ProjectFlow() {
  return (
    <section className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] sm:p-7">
      <div className="max-w-3xl">
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
          Workflow
        </div>

        <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Flow yang sederhana, tapi kuat untuk scale up
        </h2>

        <p className="mt-3 text-sm leading-7 text-white/65 sm:text-[15px]">
          Halaman ini didesain untuk membuat alur project flipper terasa ringan
          di awal, namun tetap siap berkembang ke valuation, legal tracking,
          expense ledger, cap table, dan profit distribution.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {steps.map((item) => (
          <div
            key={item.step}
            className="rounded-3xl border border-white/10 bg-[#0b1526] p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-sm font-bold text-emerald-200">
              {item.step}
            </div>

            <h3 className="mt-4 text-lg font-semibold text-white">
              {item.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-white/62">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}