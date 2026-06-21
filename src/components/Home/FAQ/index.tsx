"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

const CsIcon = ({ className = "" }: { className?: string }) => (
  <span
    aria-hidden
    className={`inline-block shrink-0 ${className}`}
    style={{
      backgroundColor: "#86efac",
      WebkitMaskImage: "url(/images/icons/customer-service.png)",
      maskImage: "url(/images/icons/customer-service.png)",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
    }}
  />
);

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const VIEWPORT = { once: true, amount: 0 } as const;
const WA_LINK = "https://wa.me/6281335716679";

const FAQS = [
  {
    q: "Bagaimana cara kerja layanan Solusindo dari awal sampai akhir?",
    a: "Mulai dari konsultasi gratis — Anda ceritakan kebutuhan dan budget, tim kami pilihkan aset yang paling sesuai. Kami kawal seluruh proses: cek legalitas, pendampingan bidding (untuk lelang), koordinasi notaris, balik nama, hingga serah terima kunci. Anda tidak perlu mengurus satu pun tahap sendirian.",
  },
  {
    q: "Apa yang membedakan Solusindo dari agen properti biasa?",
    a: "Agen biasa hanya mempertemukan pembeli dan penjual. Solusindo adalah spesialis lelang bank — kami punya akses ke aset yang belum dipublikasikan, tim hukum internal untuk verifikasi legalitas, dan pengalaman mendampingi ratusan proses bidding. Kami juga menyatukan 4 pasar properti (lelang, jual, sewa, developer) dalam satu platform — sehingga Anda tidak perlu cari-cari di banyak tempat.",
  },
  {
    q: "Apakah ada biaya layanan yang harus dibayar di muka?",
    a: "Tidak ada. Konsultasi 100% gratis dan tidak ada biaya pendaftaran. Model kami adalah success fee — biaya jasa baru ada setelah transaksi berhasil terjadi. Tidak ada biaya tersembunyi, semua dijelaskan secara transparan sebelum Anda memutuskan.",
  },
  {
    q: "Bagaimana Solusindo memastikan setiap transaksi aman secara hukum?",
    a: "Setiap aset diverifikasi tim internal kami sebelum ditawarkan: keaslian sertifikat dicek ke BPN, status sengketa diperiksa, dan PBB dipastikan tidak ada tunggakan. Untuk lelang, kami juga mengecek status penghuni dan klausul pengosongan. Proses AJB dan balik nama dikerjakan bersama notaris/PPAT terpercaya yang sudah kami vetting sendiri.",
  },
  {
    q: "Berapa lama dari konsultasi pertama sampai kunci ada di tangan saya?",
    a: "Tergantung jenis transaksi. Lelang bank: jika aset sudah ditemukan, proses bidding bisa selesai dalam 1–2 minggu; balik nama tambah 30–45 hari. Jual-beli secondary: negosiasi sampai AJB umumnya 2–4 minggu. Sewa: bisa deal dalam hitungan hari. Tim kami aktif mendorong setiap tahap agar tidak molor.",
  },
];

const FAQ = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-10 md:py-12 bg-[#0F0F0F] relative" id="faq">
      {/* ambient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 30% at 50% 100%, rgba(52,211,153,0.05), transparent 65%)",
        }}
      />

      <div className="container mx-auto px-4 max-w-screen-xl relative z-10">

        {/* ── HEADER ── */}
        <div className="max-w-2xl mx-auto text-center mb-10 md:mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-[#86efac]/10 border border-[#86efac]/25 text-[#86efac] text-[10px] font-bold tracking-[0.22em] uppercase font-mono mb-6"
          >
            <Icon icon="solar:question-circle-bold" />
            Pusat Bantuan
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={VIEWPORT}
            transition={{ duration: 0.7, ease: EASE, delay: 0.07 }}
            className="text-4xl md:text-5xl font-extrabold text-white leading-[1.06] tracking-tight mb-5"
          >
            Semua yang Perlu{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-400">
              Anda Ketahui
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VIEWPORT}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-white/45 text-base leading-relaxed"
          >
            Lima pertanyaan yang paling sering diajukan sebelum memulai perjalanan
            properti bersama kami.
          </motion.p>
        </div>

        {/* ── ACCORDION ── */}
        <div className="max-w-3xl mx-auto">
          {/* top divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.6, ease: EASE }}
            className="h-px bg-white/[0.07] origin-left mb-0"
          />

          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                {/* item */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
                  className="relative"
                >
                  {/* left accent bar */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ scaleY: 0, opacity: 0 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        exit={{ scaleY: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="absolute left-0 top-0 bottom-0 w-[2px] origin-top rounded-full"
                        style={{
                          background:
                            "linear-gradient(to bottom, #86efac, #34d399, transparent)",
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* open bg glow */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        className="absolute inset-0 pointer-events-none rounded-r-xl"
                        style={{
                          background:
                            "linear-gradient(to right, rgba(134,239,172,0.04), transparent 50%)",
                        }}
                      />
                    )}
                  </AnimatePresence>

                  {/* button row */}
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="group w-full flex items-start gap-6 md:gap-8 py-7 md:py-8 px-5 text-left focus:outline-none"
                  >
                    {/* number */}
                    <motion.span
                      animate={{ color: isOpen ? "#86efac" : "rgba(255,255,255,0.18)" }}
                      transition={{ duration: 0.2 }}
                      className="font-mono text-xs font-bold pt-[3px] shrink-0 select-none"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </motion.span>

                    {/* question */}
                    <motion.span
                      animate={{ color: isOpen ? "#ffffff" : "rgba(255,255,255,0.72)" }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 text-base md:text-[1.125rem] font-semibold leading-snug group-hover:text-white transition-colors duration-200"
                    >
                      {faq.q}
                    </motion.span>

                    {/* toggle icon */}
                    <motion.div
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 22 }}
                      className={`shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center mt-0.5 transition-all duration-200 ${
                        isOpen
                          ? "bg-[#86efac] border-transparent text-black"
                          : "bg-white/[0.04] border-white/[0.1] text-white/40 group-hover:border-white/20 group-hover:text-white/70"
                      }`}
                    >
                      <Icon icon="solar:add-square-bold" className="text-base" />
                    </motion.div>
                  </button>

                  {/* answer */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <motion.div
                          initial={{ y: -8, filter: "blur(4px)" }}
                          animate={{ y: 0, filter: "blur(0px)" }}
                          exit={{ y: -4, filter: "blur(2px)" }}
                          transition={{ duration: 0.3, ease: EASE }}
                          className="pl-[3.25rem] md:pl-[4rem] pr-5 pb-8"
                        >
                          <p className="text-white/52 text-sm md:text-[15px] leading-[1.8]">
                            {faq.a}
                          </p>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* divider */}
                <div className="h-px bg-white/[0.07] mx-5" />
              </div>
            );
          })}
        </div>

        {/* ── FOOTER CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
          className="max-w-3xl mx-auto mt-12 flex flex-col sm:flex-row items-center justify-between gap-5 px-5 py-6 rounded-2xl border border-white/[0.07] bg-white/[0.02]"
        >
          <div className="flex items-center gap-3 text-sm">
            <div className="w-9 h-9 rounded-xl bg-[#86efac]/10 border border-[#86efac]/20 flex items-center justify-center shrink-0">
              <CsIcon className="w-5 h-5" />
            </div>
            <span className="text-white/50">
              Masih ada pertanyaan?{" "}
              <span className="text-white/80 font-medium">Tim kami siap membantu 24 jam.</span>
            </span>
          </div>
          <motion.a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#86efac] hover:bg-[#6ee7b7] text-black text-sm font-bold shadow-[0_0_20px_rgba(134,239,172,0.25)] hover:shadow-[0_0_32px_rgba(134,239,172,0.45)] transition-colors"
          >
            <Icon icon="ic:baseline-whatsapp" className="text-base" />
            Tanya Sekarang
          </motion.a>
        </motion.div>

      </div>
    </section>
  );
};

export default FAQ;
