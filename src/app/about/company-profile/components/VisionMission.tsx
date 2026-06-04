"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle, GoldRule } from "./_shared";

const missions = [
  {
    icon: "solar:medal-star-bold-duotone",
    title: "Layanan Terbaik",
    desc: "Mengedepankan integritas dan profesionalisme di setiap interaksi dengan pengguna jasa.",
  },
  {
    icon: "solar:scale-balanced-bold-duotone",
    title: "Keadilan & Kepastian Hukum",
    desc: "Memberikan solusi terbaik dengan prinsip keadilan dan kepastian hukum bagi semua pihak.",
  },
  {
    icon: "solar:chart-2-bold-duotone",
    title: "Kontribusi Ekonomi Negara",
    desc: "Berkontribusi sebesar-besarnya bagi kemajuan ekonomi dan penerimaan negara.",
  },
];

const VisionMission: React.FC = () => {
  return (
    <section className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-[#05070D]">
      <AmbientBackdrop variant="gold" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel tone="gold">Visi & Misi</PillLabel>
          <SectionTitle
            title={
              <>
                Solusi dan{" "}
                <span className="bg-gradient-to-r from-[#F5C56A] to-[#FFE6A6] bg-clip-text text-transparent">
                  Sinergi.
                </span>
              </>
            }
            subtitle="Filosofi nama kami: kehadiran Solusindo Premier adalah solusi bagi permasalahan pengguna jasa dan pihak terkait, dicapai melalui kerjasama dan sinergi yang baik sebagai agensi terpercaya."
          />
        </div>

        {/* Vision card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-14 mx-auto max-w-4xl"
        >
          <div className="relative rounded-[2rem] p-[1px] bg-gradient-to-br from-[#F5C56A]/40 via-white/5 to-[#86efac]/40">
            <div className="rounded-[2rem] bg-[#0B0F17]/95 backdrop-blur-xl p-10 md:p-14 text-center">
              <Icon
                icon="solar:target-bold-duotone"
                className="mx-auto text-5xl text-[#F5C56A]"
              />
              <div className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#F5C56A] mt-4">
                Visi
              </div>
              <p className="mt-5 text-white/85 text-lg md:text-xl leading-relaxed italic font-light max-w-3xl mx-auto">
                &ldquo;Menjadi <span className="not-italic font-semibold text-white">agensi terpercaya</span> yang
                menghadirkan solusi dan sinergi terbaik bagi pengguna jasa dan
                pihak terkait — di setiap transaksi, di setiap resolusi aset.&rdquo;
              </p>
              <GoldRule className="mx-auto mt-6" />
            </div>
          </div>
        </motion.div>

        {/* Missions */}
        <div className="mt-16">
          <div className="text-center">
            <div className="text-[10px] tracking-[0.4em] uppercase font-bold text-[#86efac]">
              Misi
            </div>
            <h3 className="mt-3 text-2xl md:text-3xl font-bold text-white">
              Tiga Pilar Layanan Kami
            </h3>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {missions.map((m, i) => (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.6 }}
                className="group relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent backdrop-blur-md p-7 hover:border-[#86efac]/30 transition-all duration-500"
              >
                <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-[#86efac]/5 blur-3xl group-hover:bg-[#86efac]/15 transition-all duration-700 -mr-6 -mt-6" />
                <div className="relative">
                  <div className="text-7xl font-extrabold text-white/[0.04] absolute -top-4 right-0 select-none">
                    0{i + 1}
                  </div>
                  <div className="h-12 w-12 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center mb-5">
                    <Icon icon={m.icon} className="text-2xl text-[#86efac]" />
                  </div>
                  <h4 className="text-white font-bold text-lg">{m.title}</h4>
                  <p className="mt-2 text-white/55 text-sm leading-relaxed">
                    {m.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisionMission;
