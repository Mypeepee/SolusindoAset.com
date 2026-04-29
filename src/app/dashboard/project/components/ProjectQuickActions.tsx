const actions = [
    {
      title: "Tambah Project",
      desc: "Buat project flipper baru",
      icon: "＋",
    },
    {
      title: "Pilih Listing",
      desc: "Ambil properti dari tabel listing",
      icon: "⌂",
    },
    {
      title: "Kelola Investor",
      desc: "Atur investor dan nominal pendanaan",
      icon: "◉",
    },
  ];
  
  export default function ProjectQuickActions() {
    return (
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Quick action
            </p>
            <h3 className="mt-1 text-xl font-black text-white">
              Aksi utama project
            </h3>
          </div>
        </div>
  
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((item) => (
            <button
              key={item.title}
              className="group rounded-[26px] border border-white/10 bg-white/[0.035] p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-emerald-400/18 hover:bg-white/[0.06]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-500/12 text-lg font-black text-emerald-300">
                {item.icon}
              </div>
              <p className="mt-4 text-base font-black text-white">
                {item.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                {item.desc}
              </p>
            </button>
          ))}
        </div>
      </section>
    );
  }