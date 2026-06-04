"use client";

import React from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

const ContactCTA: React.FC = () => {
  return (
    <section
      id="kontak"
      className="relative w-full bg-[#05070D] py-10 sm:py-12 lg:py-14 overflow-hidden"
    >
      {/* Big ambient gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[36rem] w-[60rem] rounded-full bg-emerald-500/[0.08] blur-[140px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[16rem] w-[40rem] rounded-full bg-teal-500/[0.08] blur-[120px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse at center, black 25%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 25%, transparent 70%)",
        }}
      />

      <div className="container relative mx-auto px-4 sm:px-6 max-w-screen-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative mx-auto max-w-4xl rounded-[2.25rem] p-[1px] bg-gradient-to-br from-emerald-400/40 via-white/[0.05] to-transparent"
        >
          <div className="relative rounded-[2.25rem] bg-[#0B0F17]/95 backdrop-blur-xl p-7 sm:p-10 lg:p-12 text-center overflow-hidden">
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-[28rem] rounded-full bg-emerald-400/20 blur-3xl" />

            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
              className="mx-auto h-16 w-16 rounded-2xl bg-emerald-400/15 border border-emerald-400/35 flex items-center justify-center shadow-[0_0_40px_rgba(52,211,153,0.3)]"
            >
              <Icon
                icon="solar:hand-shake-bold-duotone"
                className="text-emerald-300 text-3xl"
              />
            </motion.div>

            <h2 className="mt-5 text-white font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-tight">
              Saatnya Aset Anda{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Bekerja untuk Anda.
              </span>
            </h2>

            <p className="mt-4 mx-auto max-w-2xl text-white/65 text-[14px] sm:text-base leading-relaxed">
              Lebih dari sekedar dipasarkan — aset Anda dikelola dengan
              standar institusional, dilindungi perjanjian resmi, dan diawasi
              tim profesional sampai serah terima dana.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
              <a
                href="#form-titip-jual"
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-[#05070D] font-bold text-sm tracking-wide shadow-[0_8px_30px_rgba(52,211,153,0.3)] hover:shadow-[0_14px_44px_rgba(52,211,153,0.5)] active:scale-[0.98] transition-all"
              >
                Mulai Titip Jual — Gratis
                <Icon
                  icon="solar:arrow-right-bold"
                  className="text-lg group-hover:translate-x-1 transition-transform"
                />
              </a>
              <a
                href="https://wa.me/6281335716679?text=Halo%20Solusindo%20Premier%2C%20saya%20ingin%20konsultasi%20titip%20jual%20properti."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full border border-emerald-400/30 bg-white/[0.04] backdrop-blur-md text-white text-sm font-semibold hover:bg-white/[0.08] hover:border-emerald-400/50 active:scale-[0.98] transition-all"
              >
                <Icon
                  icon="ic:baseline-whatsapp"
                  className="text-lg text-emerald-300"
                />
                Konsultasi via WhatsApp
              </a>
            </div>

            {/* Contact lines */}
            <div className="mt-8 grid sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
              {[
                {
                  i: "solar:phone-rounded-bold-duotone",
                  l: "Hotline",
                  v: "+62 813 3571 6679",
                  h: "tel:+6281335716679",
                },
                {
                  i: "solar:letter-bold-duotone",
                  l: "Email",
                  v: "closingsystem@gmail.com",
                  h: "mailto:closingsystem@gmail.com",
                },
                {
                  i: "solar:map-point-bold-duotone",
                  l: "Kantor Pusat",
                  v: "Santorini Town Square, Surabaya",
                  h: "https://maps.google.com/?q=Santorini+Town+Square+Surabaya",
                },
              ].map((c) => (
                <a
                  key={c.l}
                  href={c.h}
                  target={c.h.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-md p-3.5 hover:border-emerald-400/30 hover:bg-emerald-400/[0.05] hover:-translate-y-0.5 transition-all text-left"
                >
                  <Icon
                    icon={c.i}
                    className="text-emerald-300 text-xl group-hover:scale-110 transition-transform"
                  />
                  <div className="mt-2 text-[10.5px] font-bold tracking-[0.18em] uppercase text-white/45">
                    {c.l}
                  </div>
                  <div className="mt-0.5 text-[13px] font-semibold text-white break-words">
                    {c.v}
                  </div>
                </a>
              ))}
            </div>

            {/* Compliance footer */}
            <div className="mt-8 pt-5 border-t border-white/[0.06] flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10.5px] tracking-[0.18em] uppercase text-white/35 font-bold">
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  icon="solar:shield-check-bold"
                  className="text-emerald-400/70"
                />
                AREBI DPD Jatim
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  icon="solar:verified-check-bold"
                  className="text-emerald-400/70"
                />
                PMK 122/2023
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  icon="solar:document-bold"
                  className="text-emerald-400/70"
                />
                PT Solusi Tangguh Rejeki
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ContactCTA;
