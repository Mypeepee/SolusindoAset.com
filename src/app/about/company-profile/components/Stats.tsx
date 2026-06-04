"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

type StatProps = {
  icon: string;
  prefix?: string;
  suffix?: string;
  target: number;
  decimals?: number;
  label: string;
  desc: string;
};

const Counter: React.FC<{
  target: number;
  decimals?: number;
  active: boolean;
  duration?: number;
}> = ({ target, decimals = 0, active, duration = 1800 }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return (
    <span>
      {decimals
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString("id-ID")}
    </span>
  );
};

const stats: StatProps[] = [
  {
    icon: "solar:buildings-3-bold-duotone",
    target: 266327,
    suffix: "+",
    label: "Active Listings",
    desc: "Portofolio properti & aset terkurasi.",
  },
  {
    icon: "solar:wallet-money-bold-duotone",
    prefix: "Rp ",
    target: 94.1,
    decimals: 1,
    suffix: "B",
    label: "Transaction Volume",
    desc: "Volume transaksi yang berhasil dieksekusi.",
  },
  {
    icon: "solar:users-group-rounded-bold-duotone",
    target: 60,
    suffix: "+",
    label: "Professional Agents",
    desc: "Tim ahli & pemasaran tersertifikasi.",
  },
  {
    icon: "solar:medal-ribbons-star-bold-duotone",
    target: 98.7,
    decimals: 1,
    suffix: "%",
    label: "Client Satisfaction",
    desc: "Rasio kepuasan klien berdasarkan survei.",
  },
];

const Stats: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-[#05070D]"
    >
      <AmbientBackdrop variant="gold" intensity="high" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel tone="gold">Track Record</PillLabel>
          <SectionTitle
            title={
              <>
                Transparansi Data,{" "}
                <span className="bg-gradient-to-r from-[#F5C56A] to-[#FFE6A6] bg-clip-text text-transparent">
                  Rasio Keberhasilan
                </span>{" "}
                yang Solid.
              </>
            }
            subtitle="Bukan klaim, bukan asumsi. Portofolio lelang dan manajemen NPL kami terukur dalam angka — membuktikan efektivitas resolusi aset bagi mitra perbankan."
          />
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-[#F5C56A]/30 via-white/5 to-transparent"
            >
              <div className="relative h-full rounded-3xl bg-[#0B0F17]/95 p-7 overflow-hidden">
                {/* shimmer */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute inset-x-0 -top-20 h-32 bg-gradient-to-b from-[#F5C56A]/20 to-transparent blur-2xl" />
                </div>

                <Icon
                  icon={s.icon}
                  className="text-3xl text-[#F5C56A]"
                />

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                    {s.prefix}
                    <Counter target={s.target} decimals={s.decimals} active={inView} />
                    {s.suffix}
                  </span>
                </div>

                <div className="mt-4 text-[10px] uppercase tracking-[0.3em] font-bold text-[#F5C56A]">
                  {s.label}
                </div>
                <p className="mt-2 text-white/55 text-sm leading-relaxed">{s.desc}</p>

                <div className="mt-5 h-px w-full bg-gradient-to-r from-[#F5C56A]/40 via-white/5 to-transparent" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
