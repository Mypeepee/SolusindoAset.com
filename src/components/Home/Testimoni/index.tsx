import React from "react";
import { Icon } from "@iconify/react";

const CARDS = [
  {
    name: "Venatha Tanoto",
    init: "VT",
    deal: "Rumah Lelang · Surabaya",
    badge: "Hemat Rp 1,1 M",
    color: "#34d399",
    border: "rgba(134,239,172,0.4)",
    glow: "rgba(52,211,153,0.06)",
    quote:
      "Proses balik nama yang biasanya memakan waktu berbulan-bulan, di sini selesai hanya dalam sebulan. Tidak lama kemudian serah terima berjalan mulus dan kunci sudah di tangan saya. Pelayanan yang benar-benar melampaui ekspektasi.",
  },
  {
    name: "Hadi Hermanto",
    init: "HH",
    deal: "Gudang Lelang · Surabaya",
    badge: "Hemat Rp 1,2 M",
    color: "#60a5fa",
    border: "rgba(96,165,250,0.4)",
    glow: "rgba(96,165,250,0.06)",
    quote:
      "Puji Tuhan, prosesnya berjalan lebih baik dari yang saya harapkan. Serah terima bahkan bisa dilakukan sebelum balik nama selesai — padahal kondisi hukum aset ini cukup kompleks. Solusindo menangani semuanya dengan profesional dan tenang.",
  },
  {
    name: "PT. Alam Hijau",
    init: "AH",
    deal: "Pabrik Lelang · Mojokerto",
    badge: "Hemat Rp 35 M",
    color: "#c084fc",
    border: "rgba(192,132,252,0.4)",
    glow: "rgba(192,132,252,0.06)",
    quote:
      "Pelayanan yang benar-benar komprehensif — pendampingan site visit lengkap dengan aerial drone survey, hingga koordinasi serah terima yang efisien. Berkat prosesnya yang cepat, kami langsung bisa memulai renovasi dan mengoperasikan fasilitas jauh lebih awal dari jadwal.",
  },
  {
    name: "Lydia",
    init: "LY",
    deal: "Rumah Second · Surabaya",
    badge: "Di bawah pasar",
    color: "#fbbf24",
    border: "rgba(251,191,36,0.4)",
    glow: "rgba(251,191,36,0.06)",
    quote:
      "Sangat bersyukur bisa menemukan properti untuk anak saya di bawah harga pasar, berkat tim Solusindo yang proaktif dan teliti. Proses notaris diselesaikan sangat cepat — tidak lama kemudian anak saya sudah bisa langsung menempati rumah barunya.",
  },
  {
    name: "Richard Ang",
    init: "RA",
    deal: "Mediasi Eksekusi · Surabaya",
    badge: "Deal 2 minggu",
    color: "#34d399",
    border: "rgba(134,239,172,0.4)",
    glow: "rgba(52,211,153,0.06)",
    quote:
      "Untuk kebutuhan mediasi dan eksekusi pengosongan, saya selalu percayakan ke Solusindo. Prosesnya cepat — serah terima tuntas dalam hitungan minggu — dengan biaya yang sangat kompetitif. Sudah beberapa kali memakai jasa mereka, tidak pernah mengecewakan.",
  },
  {
    name: "Richard Ang",
    init: "RA",
    deal: "Mediasi Eksekusi · Surabaya",
    badge: "Deal 1 bulan",
    color: "#2dd4bf",
    border: "rgba(45,212,191,0.4)",
    glow: "rgba(45,212,191,0.06)",
    quote:
      "Bukan hanya soal kecepatan dan harga yang kompetitif — layanan after-service mereka yang membuat saya terus kembali. Semua ditangani secara menyeluruh; saya cukup duduk dan semua sudah beres. Benar-benar mitra yang bisa diandalkan untuk jangka panjang.",
  },
];

const DURATION = CARDS.length * 4.5;

function maskWord(w: string) {
  if (w.length <= 1) return w;
  if (w.length === 2) return w[0] + "*";
  return w[0] + "*".repeat(w.length - 2) + w[w.length - 1];
}

function maskName(full: string) {
  const prefixMatch = full.match(/^(PT\.|CV\.|UD\.)\s/);
  if (prefixMatch) {
    const prefix = prefixMatch[0];
    return prefix + full.slice(prefix.length).split(" ").map(maskWord).join(" ");
  }
  return full.split(" ").map(maskWord).join(" ");
}

function TestiCard({ t, hidden }: { t: (typeof CARDS)[number]; hidden?: boolean }) {
  return (
    <div aria-hidden={hidden} className="shrink-0 w-[310px] sm:w-[340px]">
      <div
        className="h-full rounded-[1.5rem] p-[1px] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${t.border}, rgba(255,255,255,0.04) 50%, ${t.border})`,
        }}
      >
        <div
          className="h-full rounded-[calc(1.5rem-1px)] flex flex-col p-5 sm:p-6"
          style={{
            background: `radial-gradient(ellipse at 15% 5%, ${t.glow}, transparent 55%), linear-gradient(155deg, #141414, #0a0a0a)`,
          }}
        >
          <div className="flex items-center gap-0.5 mb-3.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Icon key={i} icon="solar:star-bold" className="text-amber-400 text-[11px]" />
            ))}
          </div>

          <p className="text-white/62 text-[13px] leading-[1.75] flex-1 mb-5">
            &ldquo;{t.quote}&rdquo;
          </p>

          <div
            className="flex items-center justify-between gap-2 pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black text-black"
                style={{
                  width: 34,
                  height: 34,
                  background: `linear-gradient(135deg, ${t.color}, ${t.color}99)`,
                  boxShadow: `0 0 12px ${t.color}40`,
                }}
              >
                {t.init}
              </div>
              <div>
                <p className="text-white font-bold text-[13px] leading-tight">{maskName(t.name)}</p>
                <p className="text-[11px] mt-px" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {t.deal}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                Keuntungan
              </p>
              <p className="font-bold text-[13px]" style={{ color: t.color }}>
                {t.badge}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Testimoni = () => (
  <section className="py-10 md:py-12 bg-[#0F0F0F] relative overflow-hidden">
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 55% 35% at 50% 50%, rgba(52,211,153,0.04), transparent 65%)",
      }}
    />

    <div className="relative z-10">
      <div className="container mx-auto px-4 max-w-screen-xl">
        <div className="text-center mb-8 md:mb-10 max-w-2xl mx-auto" data-aos="fade-up">
          <span className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-white/5 border border-white/10 text-[#86efac] text-[10px] font-bold tracking-[0.22em] uppercase font-mono mb-4">
            <Icon icon="solar:verified-check-bold" className="text-sm" />
            Bukti Nyata
          </span>

          <h2 className="text-3xl md:text-[2.6rem] font-extrabold text-white leading-tight mb-3">
            Mereka Sudah{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#86efac] to-teal-500">
              Pegang Kunci
            </span>
          </h2>

          <p className="text-white/45 text-sm md:text-base leading-relaxed">
            Ratusan keluarga &amp; investor sudah mewujudkan aset impiannya bersama kami.
          </p>
        </div>
      </div>

      <div className="relative" data-aos="fade-up" data-aos-delay="150">
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 sm:w-40 z-10"
          style={{ background: "linear-gradient(to right, #0F0F0F, transparent)" }}
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 sm:w-40 z-10"
          style={{ background: "linear-gradient(to left, #0F0F0F, transparent)" }}
        />

        <div
          className="flex w-max gap-4 animate-logo-marquee"
          style={{ animationDuration: `${DURATION}s` }}
        >
          {CARDS.map((t) => (
            <TestiCard key={t.name} t={t} />
          ))}
          {CARDS.map((t) => (
            <TestiCard key={`${t.name}-2`} t={t} hidden />
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default Testimoni;
