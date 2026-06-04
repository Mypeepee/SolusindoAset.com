"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

const coverage = [
  { name: "Jawa Timur", primary: true },
  { name: "DKI Jakarta" },
  { name: "Jawa Barat" },
  { name: "Jawa Tengah" },
  { name: "Bali & Nusra" },
  { name: "Sumatera" },
];

const banks = [
  { name: "Mandiri", color: "#003D79" },
  { name: "BCA", color: "#0060AF" },
  { name: "BRI", color: "#00529B" },
  { name: "BNI", color: "#F37021" },
  { name: "BTN", color: "#00529C" },
];

const Network: React.FC = () => {
  return (
    <section className="relative w-full py-14 sm:py-16 md:py-20 overflow-hidden bg-[#05070D]">
      <AmbientBackdrop variant="navy" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Jaringan & Kemitraan</PillLabel>
          <SectionTitle
            title={
              <>
                Jangkauan Nasional,{" "}
                <span className="bg-gradient-to-r from-[#86efac] to-teal-400 bg-clip-text text-transparent">
                  Kemitraan Strategis.
                </span>
              </>
            }
            subtitle="Operasional skala nasional yang diperkuat oleh kemitraan strategis dengan institusi perbankan terkemuka."
          />
        </div>

        {/* Coverage */}
        <div className="mt-16">
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#86efac] mb-5 text-center">
            Coverage Area Nasional
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {coverage.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className={`group relative rounded-2xl border px-5 py-4 flex items-center gap-3 transition-all duration-500 ${
                  c.primary
                    ? "border-[#F5C56A]/40 bg-gradient-to-br from-[#F5C56A]/10 to-transparent"
                    : "border-white/10 bg-white/[0.025] hover:border-[#86efac]/30"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    c.primary
                      ? "bg-[#F5C56A]/20 border border-[#F5C56A]/30"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  <Icon
                    icon="solar:map-point-bold-duotone"
                    className={`text-xl ${c.primary ? "text-[#F5C56A]" : "text-[#86efac]"}`}
                  />
                </div>
                <div>
                  <div className="text-white font-bold text-sm">{c.name}</div>
                  {c.primary && (
                    <div className="text-[9px] tracking-widest uppercase font-bold text-[#F5C56A]">
                      Headquarters
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mitra Bank */}
        <div className="mt-20">
          <div className="text-[10px] tracking-[0.3em] uppercase font-bold text-[#F5C56A] mb-5 text-center">
            Mitra Perbankan Utama
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 md:p-10"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
              {banks.map((b, i) => (
                <motion.div
                  key={b.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="group rounded-2xl border border-white/10 bg-[#0B0F17] p-6 text-center hover:border-white/25 transition-all duration-500"
                >
                  <div
                    className="h-12 w-12 mx-auto rounded-xl flex items-center justify-center font-extrabold text-lg"
                    style={{
                      background: `linear-gradient(135deg, ${b.color}40, ${b.color}10)`,
                      border: `1px solid ${b.color}80`,
                      color: "#fff",
                    }}
                  >
                    <Icon icon="solar:bank-bold" className="text-xl" />
                  </div>
                  <div className="mt-3 text-white font-bold text-sm">Bank</div>
                  <div className="text-[10px] uppercase tracking-widest font-bold text-white/50 mt-0.5">
                    {b.name}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 text-center text-[10px] tracking-widest uppercase text-white/40">
              + Vendor Bank lainnya berskala nasional
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Network;
