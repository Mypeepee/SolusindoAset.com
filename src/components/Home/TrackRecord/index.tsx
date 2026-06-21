"use client";

import React, { useRef } from "react";
import { Icon } from "@iconify/react";
import { motion, useInView } from "framer-motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

// NOTE: angka representatif — sambungkan ke data nyata (closing/CRM) bila ada.
const stats = [
  { value: 1200, prefix: "", suffix: "+", label: "Properti Terjual", icon: "solar:home-smile-bold-duotone" },
  { value: 850, prefix: "Rp ", suffix: " M+", label: "Nilai Transaksi", icon: "solar:wallet-money-bold-duotone" },
  { value: 45, prefix: "", suffix: "+", label: "Kota Terjangkau", icon: "solar:map-point-bold-duotone" },
  { value: 300, prefix: "", suffix: "+", label: "Agen Bersertifikat", icon: "solar:users-group-rounded-bold-duotone" },
];

function CountUp({ target, run }: { target: number; run: boolean }) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (!run) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 1600;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target]);
  return <>{val.toLocaleString("id-ID")}</>;
}

const TrackRecord = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-12 md:py-16 bg-[#0F0F0F] relative overflow-hidden border-y border-white/5">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(52,211,153,0.05), transparent 70%)",
        }}
      />
      <div ref={ref} className="container mx-auto px-4 max-w-screen-xl relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-3xl overflow-hidden border border-white/10">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.1 }}
              className="bg-[#121212] p-6 md:p-8 text-center flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-4">
                <Icon icon={s.icon} className="text-2xl text-[#86efac]" />
              </div>
              <div className="text-3xl md:text-[2.4rem] font-extrabold text-white tracking-tight tabular-nums leading-none">
                {s.prefix}
                <CountUp target={s.value} run={inView} />
                {s.suffix}
              </div>
              <div className="text-xs md:text-sm text-white/45 mt-2 font-medium">{s.label}</div>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-[11px] text-white/30 mt-4">
          *Akumulatif sejak berdiri, diperbarui berkala.
        </p>
      </div>
    </section>
  );
};

export default TrackRecord;
