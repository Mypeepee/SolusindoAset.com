"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import {
  PillLabel,
  SectionTitle,
} from "../../about/company-profile/components/_shared";

type QA = { q: string; a: React.ReactNode; cat: string };

const FAQS: QA[] = [
  {
    cat: "Keamanan",
    q: "Apakah sertifikat asli saya akan dipegang Solusindo?",
    a: (
      <>
        Tidak. <b>Sertifikat asli tetap dipegang oleh Anda</b>. Kami hanya
        membutuhkan salinan untuk verifikasi keabsahan dan keperluan listing.
        Saat closing, sertifikat asli baru diserahkan kepada notaris/PPAT yang
        Anda setujui — bukan kepada agent.
      </>
    ),
  },
  {
    cat: "Keamanan",
    q: "Bagaimana data pribadi & alamat properti saya dilindungi?",
    a: (
      <>
        Alamat lengkap, data KTP, dan nomor sertifikat <b>tidak pernah</b>{" "}
        ditampilkan di listing publik. Yang dipublikasikan hanya zona umum
        (mis. &ldquo;Citraland, Surabaya Barat&rdquo;) dan foto properti yang
        sudah Anda setujui. Anda dapat meminta hapus data permanen kapan saja.
      </>
    ),
  },
  {
    cat: "Biaya",
    q: "Berapa total biaya yang harus saya keluarkan di awal?",
    a: (
      <>
        <b>Rp 0</b>. Tidak ada biaya pendaftaran, biaya foto, biaya iklan, atau
        biaya konsultasi. Komisi <b>hanya</b> dipotong dari nilai transaksi
        setelah closing berhasil dan dana cair ke rekening Anda.
      </>
    ),
  },
  {
    cat: "Biaya",
    q: "Berapa komisi yang dikenakan?",
    a: (
      <>
        Standar komisi properti residensial <b>2,5%–3%</b> dari nilai
        transaksi, sesuai harga jual dan kompleksitas. Untuk properti komersial
        bisa berbeda. Semuanya disepakati <b>tertulis di Perjanjian Pemasaran
        Aset</b> sebelum listing tayang.
      </>
    ),
  },
  {
    cat: "Proses",
    q: "Berapa lama sampai aset saya siap dipasarkan?",
    a: (
      <>
        Rata-rata <b>4–7 hari kerja</b> sejak penandatanganan perjanjian:
        survey lokasi, fotografi profesional, penulisan deskripsi, lalu publish
        ke seluruh kanal pemasaran. Jika butuh lebih cepat, beritahu konsultan
        — kami punya jalur prioritas.
      </>
    ),
  },
  {
    cat: "Proses",
    q: "Apakah saya bisa membatalkan titip jual di tengah jalan?",
    a: (
      <>
        Bisa. Hak pembatalan tertuang jelas di perjanjian. Selama belum ada
        transaksi yang sedang berjalan, Anda dapat menarik aset kapan saja
        dengan pemberitahuan tertulis. Detail klausul (mis. masa eksklusivitas
        atau penggantian biaya marketing yang telah dikeluarkan) dibahas
        terbuka sebelum tanda tangan.
      </>
    ),
  },
  {
    cat: "Pemasaran",
    q: "Lewat channel apa saja properti saya dipasarkan?",
    a: (
      <>
        MLS internal Solusindo, portal properti utama Indonesia, iklan
        bertarget di Meta (Instagram/Facebook), TikTok, Google Search, broadcast
        ke jaringan <b>1.200+ agent AREBI Jatim</b>, dan database{" "}
        <b>266.000+ calon pembeli</b> aktif kami.
      </>
    ),
  },
  {
    cat: "Pemasaran",
    q: "Bisakah saya tetap memasarkan sendiri secara paralel?",
    a: (
      <>
        Bisa, tergantung jenis perjanjian yang Anda pilih. Tersedia dua skema:{" "}
        <b>Eksklusif</b> (hanya Solusindo) dengan keuntungan prioritas tinggi,
        atau <b>Non-Eksklusif</b> (Anda boleh paralel). Konsultan akan
        menjelaskan plus-minus keduanya saat konsultasi awal.
      </>
    ),
  },
  {
    cat: "Pembayaran",
    q: "Bagaimana mekanisme pembayaran saat closing?",
    a: (
      <>
        Pembayaran berlangsung di kantor notaris/PPAT mitra melalui{" "}
        <b>rekening escrow</b> atau bilyet giro yang dapat diverifikasi.
        Sertifikat baru diserahkan setelah dana penjual masuk. Pola ini
        melindungi Anda dari risiko pembeli wanprestasi.
      </>
    ),
  },
];

const CATS = ["Semua", "Keamanan", "Biaya", "Proses", "Pemasaran", "Pembayaran"];

const FAQ: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [cat, setCat] = useState("Semua");

  const filtered = FAQS.filter((f) => cat === "Semua" || f.cat === cat);

  return (
    <section
      id="faq"
      className="relative w-full bg-gradient-to-b from-[#05070D] via-[#070A12] to-[#05070D] py-10 sm:py-12 lg:py-14 overflow-hidden"
    >
      <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-[28rem] w-[42rem] rounded-full bg-emerald-500/[0.04] blur-[120px]" />

      <div className="container relative mx-auto px-4 sm:px-6 max-w-screen-lg">
        <div className="text-center">
          <PillLabel>Pertanyaan Umum</PillLabel>
          <SectionTitle
            title={
              <>
                Jawaban Jujur untuk{" "}
                <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Pertanyaan Tersulit.
                </span>
              </>
            }
            subtitle="Hal-hal yang paling sering ditanyakan calon klien sebelum mempercayakan asetnya kepada kami."
          />
        </div>

        {/* Category filter */}
        <div className="mt-6 sm:mt-7 flex flex-wrap items-center justify-center gap-2">
          {CATS.map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                onClick={() => {
                  setCat(c);
                  setOpenIdx(0);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[11.5px] font-bold tracking-wide transition-all border ${
                  active
                    ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Accordion */}
        <div className="mt-5 space-y-2">
          {filtered.map((item, i) => {
            const open = openIdx === i;
            return (
              <motion.div
                key={`${cat}-${i}-${item.q}`}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                whileHover={{ y: -2 }}
                transition={{
                  type: "spring",
                  stiffness: 130,
                  damping: 22,
                  delay: i * 0.04,
                }}
                className={`group relative rounded-3xl p-[1px] transition-all ${
                  open
                    ? "bg-gradient-to-br from-emerald-400/35 via-white/[0.04] to-transparent"
                    : "bg-gradient-to-br from-white/[0.08] to-transparent"
                }`}
              >
                <div className="relative rounded-3xl bg-[#0B0F17]/95 backdrop-blur-xl overflow-hidden">
                  <button
                    onClick={() => setOpenIdx(open ? null : i)}
                    className="w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 flex items-start gap-3.5"
                  >
                    <span
                      className={`mt-0.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-[0.16em] uppercase shrink-0 ${
                        open
                          ? "bg-emerald-400/20 text-emerald-200"
                          : "bg-white/[0.05] text-white/45"
                      }`}
                    >
                      {item.cat}
                    </span>
                    <span
                      className={`flex-1 font-bold text-[14.5px] sm:text-[15.5px] leading-snug pr-2 transition-colors ${
                        open ? "text-white" : "text-white/85"
                      }`}
                    >
                      {item.q}
                    </span>
                    <span
                      className={`h-8 w-8 shrink-0 rounded-full border flex items-center justify-center transition-all ${
                        open
                          ? "border-emerald-400/40 bg-emerald-400/15"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <Icon
                        icon="solar:alt-arrow-down-bold"
                        className={`text-sm transition-transform duration-300 ${
                          open ? "rotate-180 text-emerald-300" : "text-white/55"
                        }`}
                      />
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-white/70 text-[13.5px] sm:text-[14px] leading-relaxed">
                          <div className="pl-0 sm:pl-[5rem] border-t border-white/[0.06] pt-3.5">
                            {item.a}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom helper */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-[12.5px] text-white/55">
            <Icon
              icon="solar:question-circle-bold-duotone"
              className="text-emerald-300/80 text-base"
            />
            Masih ada pertanyaan?
            <a
              href="https://wa.me/6281335716679"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 font-bold hover:text-emerald-200 transition-colors"
            >
              Chat konsultan kami →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
