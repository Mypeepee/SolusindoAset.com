"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Icon } from "@iconify/react";
import {
  PillLabel,
  SectionTitle,
} from "../../about/company-profile/components/_shared";

type SLA = {
  icon: string;
  target: number;
  prefix?: string;
  suffix?: string;
  unit?: string;
  label: string;
  desc: string;
};

const SLAS: SLA[] = [
  {
    icon: "solar:phone-rounded-bold-duotone",
    target: 24,
    unit: "JAM",
    label: "Response Pertama",
    desc: "Tim konsultan menghubungi Anda dalam 1×24 jam setelah pendaftaran diterima.",
  },
  {
    icon: "solar:calendar-mark-bold-duotone",
    target: 7,
    unit: "HARI",
    label: "Listing Aktif Siap Pasar",
    desc: "Foto, video, deskripsi, dan harga final tayang dalam 7 hari kerja sejak perjanjian.",
  },
  {
    icon: "solar:chart-bold-duotone",
    target: 1,
    suffix: "×",
    unit: "/MINGGU",
    label: "Laporan Performa",
    desc: "Update mingguan via WhatsApp & email: tayangan, calon pembeli, showing, penawaran.",
  },
  {
    icon: "solar:user-id-bold-duotone",
    target: 1,
    unit: "AGENT",
    label: "Dedicated Account",
    desc: "Satu agent pendamping khusus untuk Anda — bukan call center, bukan rotasi tim.",
  },
];

/** Count-up number that triggers when in view */
const CountUp: React.FC<{ to: number; duration?: number }> = ({
  to,
  duration = 1.6,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-30% 0px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 20, mass: 0.8 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  const [text, setText] = useState("0");

  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);

  useEffect(() => {
    return display.on("change", (v) => setText(v));
  }, [display]);

  return <span ref={ref}>{text}</span>;
};

const PROMISES = [
  {
    icon: "solar:lock-keyhole-minimalistic-bold-duotone",
    title: "Privasi Data Terjamin",
    desc: "Alamat lengkap & data pribadi pemilik tidak dipublikasikan. Hanya zona umum yang ditampilkan di listing.",
  },
  {
    icon: "solar:hand-stars-bold-duotone",
    title: "Hak Cabut Listing Kapan Saja",
    desc: "Anda dapat menarik aset dari pemasaran sesuai ketentuan perjanjian — transparan, tanpa penalti tersembunyi.",
  },
  {
    icon: "solar:scale-balanced-bold-duotone",
    title: "Setiap Penawaran Disampaikan",
    desc: "Apapun nilai penawarannya — Anda yang menentukan terima atau tolak. Kami tidak menyaring tanpa izin.",
  },
];

const Guarantees: React.FC = () => {
  return (
    <section
      id="komitmen"
      className="relative w-full bg-[#05070D] py-10 sm:py-12 lg:py-14 overflow-hidden"
    >
      <div className="container relative mx-auto px-4 sm:px-6 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Komitmen Layanan</PillLabel>
          <SectionTitle
            title={
              <>
                Janji Kami,{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Terukur Bukan Sekedar Kata.
                </span>
              </>
            }
            subtitle="Service Level Agreement (SLA) yang berlaku untuk setiap klien titip jual — tertulis di perjanjian, ditegakkan oleh sistem."
          />
        </div>

        {/* SLA grid */}
        <div className="mt-7 sm:mt-9 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {SLAS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                type: "spring",
                stiffness: 130,
                damping: 22,
                delay: i * 0.06,
              }}
              whileHover={{ y: -4 }}
              className="group relative rounded-3xl p-[1px] bg-gradient-to-br from-emerald-400/25 via-white/[0.04] to-transparent hover:from-emerald-400/60 transition-all duration-500"
            >
              <div className="relative h-full rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl p-4 sm:p-5 overflow-hidden">
                <div className="pointer-events-none absolute -top-12 -right-12 h-28 w-28 rounded-full bg-emerald-400/[0.06] blur-3xl group-hover:bg-emerald-400/25 transition-all duration-700" />

                <Icon
                  icon={s.icon}
                  className="text-emerald-300 text-2xl group-hover:scale-110 transition-transform duration-300"
                />

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tabular-nums leading-none">
                    {s.prefix}
                    <CountUp to={s.target} />
                    {s.suffix}
                  </span>
                  {s.unit && (
                    <span className="text-[10.5px] font-bold tracking-[0.18em] uppercase text-emerald-300">
                      {s.unit}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[12.5px] sm:text-[13px] font-bold text-white">
                  {s.label}
                </div>
                <div className="mt-1 text-[11px] sm:text-[12px] text-white/55 leading-snug">
                  {s.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Three soft promises */}
        <div className="mt-4 sm:mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          {PROMISES.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                type: "spring",
                stiffness: 130,
                damping: 22,
                delay: i * 0.07,
              }}
              whileHover={{ y: -3 }}
              className="group rounded-3xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-md p-4 sm:p-5 hover:border-emerald-400/30 hover:bg-emerald-400/[0.04] transition-all"
            >
              <Icon
                icon={p.icon}
                className="text-emerald-300 text-2xl group-hover:scale-110 transition-transform duration-300"
              />
              <h4 className="mt-2.5 text-white font-bold text-[15px] sm:text-base">
                {p.title}
              </h4>
              <p className="mt-1 text-white/55 text-[12.5px] sm:text-[13px] leading-relaxed">
                {p.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Guarantees;
