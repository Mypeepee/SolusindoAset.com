"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { motion, useInView } from "framer-motion";

type KategoriEnum =
  | 'RUMAH'
  | 'APARTEMEN'
  | 'RUKO'
  | 'TANAH'
  | 'GUDANG'
  | 'HOTEL_DAN_VILLA'
  | 'TOKO'
  | 'PABRIK';

interface CategoryItem {
  id: KategoriEnum;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  glowColor: string;
  borderColor: string;
  hexColor: string;
  desc: string;
}

const categories: CategoryItem[] = [
  { id: "RUMAH",           label: "Rumah",         icon: "solar:home-smile-bold-duotone",     color: "text-emerald-400", bgColor: "bg-emerald-400", glowColor: "rgba(52,211,153,0.18)",  borderColor: "rgba(52,211,153,0.6)",  hexColor: "#34d399", desc: "Hunian nyaman keluarga"  },
  { id: "APARTEMEN",       label: "Apartemen",     icon: "solar:city-bold-duotone",           color: "text-blue-400",    bgColor: "bg-blue-400",    glowColor: "rgba(96,165,250,0.18)",  borderColor: "rgba(96,165,250,0.6)",  hexColor: "#60a5fa", desc: "Hunian vertikal modern"  },
  { id: "RUKO",            label: "Ruko",          icon: "solar:shop-bold-duotone",           color: "text-orange-400",  bgColor: "bg-orange-400",  glowColor: "rgba(251,146,60,0.18)",  borderColor: "rgba(251,146,60,0.6)",  hexColor: "#fb923c", desc: "Rumah toko & bisnis"     },
  { id: "TANAH",           label: "Tanah",         icon: "solar:map-point-wave-bold-duotone", color: "text-green-500",   bgColor: "bg-green-500",   glowColor: "rgba(34,197,94,0.18)",   borderColor: "rgba(34,197,94,0.6)",   hexColor: "#22c55e", desc: "Investasi masa depan"    },
  { id: "GUDANG",          label: "Gudang",        icon: "solar:box-bold-duotone",            color: "text-indigo-400",  bgColor: "bg-indigo-400",  glowColor: "rgba(129,140,248,0.18)", borderColor: "rgba(129,140,248,0.6)", hexColor: "#818cf8", desc: "Logistik & penyimpanan"  },
  { id: "HOTEL_DAN_VILLA", label: "Hotel & Villa", icon: "solar:bed-bold-duotone",            color: "text-rose-400",    bgColor: "bg-rose-400",    glowColor: "rgba(251,113,133,0.18)", borderColor: "rgba(251,113,133,0.6)", hexColor: "#fb7185", desc: "Akomodasi wisata"        },
  { id: "TOKO",            label: "Kios / Toko",   icon: "solar:bag-heart-bold-duotone",      color: "text-purple-400",  bgColor: "bg-purple-400",  glowColor: "rgba(192,132,252,0.18)", borderColor: "rgba(192,132,252,0.6)", hexColor: "#c084fc", desc: "Ruang usaha ritel"       },
  { id: "PABRIK",          label: "Pabrik",        icon: "solar:garage-bold-duotone",         color: "text-yellow-400",  bgColor: "bg-yellow-400",  glowColor: "rgba(250,204,21,0.18)",  borderColor: "rgba(250,204,21,0.6)",  hexColor: "#facc15", desc: "Industri & produksi"     },
];

// Count-up pakai rAF — tidak bergantung pada ref yang mungkin null
function useCountUp(target: number, trigger: boolean): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!trigger || target === 0) return;

    const duration = 1400;
    const startTime = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, trigger]);

  return display;
}

// Card individual agar tiap-tiap card punya ref useInView sendiri
function CategoryCard({ cat, count, isLoading }: { cat: CategoryItem; count: number; isLoading: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const inView = useInView(cardRef, { once: true, margin: "-60px" });
  const shouldCount = inView && !isLoading;
  const displayCount = useCountUp(count, shouldCount);

  return (
    <div ref={cardRef}>
      <Link href={`/kategori/${cat.id.toLowerCase().replace(/_/g, "-")}`} className="block h-full">
        <div
          className="
            group relative h-full p-6 rounded-2xl
            transition-all duration-300 ease-out
            flex flex-col items-start
            overflow-hidden
            min-h-[180px]
          "
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${hovered ? cat.borderColor : "rgba(255,255,255,0.10)"}`,
            boxShadow: hovered ? `0 0 24px -4px ${cat.glowColor}` : "none",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Dynamic glow */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
            style={{ background: `radial-gradient(circle at 20% 20%, ${cat.glowColor}, transparent 65%)` }}
          />

          {/* Corner decoration */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/[0.04] to-transparent rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-150 duration-500" />

          {/* Icon */}
          <div className="w-12 h-12 mb-3 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/20">
            <Icon icon={cat.icon} className={`text-3xl ${cat.color} drop-shadow-md`} />
          </div>

          {/* Title + desc */}
          <div className="relative z-10 flex-1">
            <h3
              className="text-base font-bold transition-colors duration-300 leading-tight"
              style={{ color: hovered ? cat.hexColor : "white" }}
            >
              {cat.label}
            </h3>
            <p className="text-xs text-white/40 mt-0.5 group-hover:text-white/60 transition-colors">
              {cat.desc}
            </p>
          </div>

          {/* Count row */}
          <div className="relative z-10 mt-4 flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {/* Accent bar */}
              <div className={`w-[3px] h-4 rounded-full ${cat.bgColor} opacity-60 group-hover:opacity-100 transition-opacity`} />

              {isLoading ? (
                /* Skeleton saat loading */
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-10 h-3 rounded-full bg-white/10 animate-pulse" />
                  <span className="text-[10px] text-white/20">listing</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-bold tabular-nums tracking-tight ${cat.color}`}>
                    {displayCount.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-white/30 font-normal">listing</span>
                </div>
              )}
            </div>

            {/* Arrow on hover */}
            <div className="opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <Icon icon="solar:arrow-right-up-linear" className="text-white/40 text-base" />
            </div>
          </div>

          {/* Bottom shimmer line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white/5 overflow-hidden rounded-b-2xl">
            <motion.div
              className={`h-full ${cat.bgColor} opacity-40`}
              initial={{ scaleX: 0, originX: "left" }}
              animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ delay: 0.3, duration: 0.9, ease: "easeOut" }}
            />
          </div>
        </div>
      </Link>
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { y: 24, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 280, damping: 22 } },
};

const CategorySection = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/property/category-counts")
      .then((r) => r.json())
      .then((data) => { setCounts(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <section className="pt-4 pb-6 bg-[#0F0F0F]">
      <div className="container mx-auto px-4 max-w-screen-xl">

        <div className="mb-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-extrabold text-white mb-3"
          >
            Telusuri Berdasarkan{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-emerald-500">
              Kategori
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-white/50 text-base max-w-2xl mx-auto"
          >
            Temukan properti impian Anda dari berbagai pilihan kategori aset terbaik kami.
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {categories.map((cat) => (
            <motion.div key={cat.id} variants={itemVariants}>
              <CategoryCard
                cat={cat}
                count={counts[cat.id] ?? 0}
                isLoading={isLoading}
              />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
};

export default CategorySection;
