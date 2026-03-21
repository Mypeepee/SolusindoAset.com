import {
    Blocks,
    FolderClock,
    Hammer,
    LayoutGrid,
    Landmark,
    ScrollText,
    WalletCards,
  } from "lucide-react";
  
  const tabs = [
    {
      label: "Semua",
      icon: LayoutGrid,
    },
    {
      label: "Property yang Aku Danai",
      icon: Landmark,
    },
    {
      label: "Pendanaan Terbuka",
      icon: WalletCards,
    },
    {
      label: "Pengurusan Dokumen",
      icon: ScrollText,
    },
    {
      label: "Eksekusi",
      icon: Blocks,
    },
    {
      label: "Renovasi",
      icon: Hammer,
    },
    {
      label: "Sedang Dijual",
      icon: FolderClock,
    },
  ];
  
  export default function ProjectCategoryTabs() {
    return (
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#08111d] to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#08111d] to-transparent md:hidden" />
  
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = index === 0;
  
            return (
              <button
                key={tab.label}
                type="button"
                className={[
                  "group inline-flex shrink-0 items-center gap-2.5 rounded-full border px-4 py-3 text-sm font-semibold backdrop-blur-xl transition duration-200 active:scale-[0.99]",
                  active
                    ? "border-emerald-300/20 bg-[linear-gradient(135deg,#34d399_0%,#4ade80_100%)] text-[#07110b] shadow-[0_12px_30px_rgba(52,211,153,0.24)]"
                    : "border-white/10 bg-white/[0.04] text-slate-300 shadow-[0_10px_25px_rgba(0,0,0,0.10)] hover:bg-white/[0.07] hover:text-white",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full transition",
                    active
                      ? "bg-black/10 text-[#07110b]"
                      : "bg-white/[0.06] text-slate-300 group-hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
  
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }