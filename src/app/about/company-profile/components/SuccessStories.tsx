"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

type Story = {
  images: string[]; // 2-3 photos per project
  type: string;
  title: string;
  location: string;
  desc: string;
  marketPrice: number; // Rupiah
  dealPrice: number; // Rupiah
  tiktokUrl?: string;
};

/* TODO: ganti `images` ke foto properti asli. */
const stories: Story[] = [
  {
    images: [
      "/images/hero/pasinan1.jpg",
      "/images/hero/pasinan2.jpg",
      "/images/hero/pasinan3.jpg",
    ],
    type: "Aset Lelang",
    title: "Pabrik Mojokerto",
    location: "Mojokerto, Jawa Timur",
    desc: "Hanya 10 bulan. Hemat Rp 27 miliar. Kunci sudah di tangan klien — bersih, sah, dan tuntas secara hukum.",
    marketPrice: 50_000_000_000,
    dealPrice: 23_000_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxo1tXm3/",
  },
  {
    images: [
      "/images/hero/kedinding1.jpg",
      "/images/hero/kedinding2.jpg",
    ],
    type: "Aset Lelang",
    title: "Gudang Surabaya",
    location: "Surabaya, Jawa Timur",
    desc: "Kunci sudah di tangan — bahkan sebelum balik nama selesai. Hemat Rp 1,1 miliar, tanpa menunggu birokrasi pertanahan berbulan-bulan.",
    marketPrice: 2_700_000_000,
    dealPrice: 1_565_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxoR7DxM/",
  },
  {
    images: [
      "/images/hero/unimas2.jpg",
      "/images/hero/unimas3.jpg",
    ],
    type: "Aset Lelang",
    title: "Rumah Sidoarjo",
    location: "Sidoarjo, Jawa Timur",
    desc: "Aset masih bersengketa, balik nama belum selesai — kunci tetap berpindah tangan. Hemat Rp 900 juta, karena hukum kami berdiri di depan masalah, bukan menunggu di belakang.",
    marketPrice: 2_500_000_000,
    dealPrice: 1_600_000_000,
    tiktokUrl:
      "https://www.tiktok.com/@koko_lelang/video/7567352888402464008",
  },
  {
    images: ["/images/hero/rungkut.jpg"],
    type: "Aset Lelang",
    title: "Rumah Surabaya",
    location: "Surabaya, Jawa Timur",
    desc: "Dihadang ormas di lapangan — kunci tetap berpindah ke klien. Hemat Rp 1 miliar, karena keberanian kami bukan retorika, melainkan eksekusi yang nyata.",
    marketPrice: 2_200_000_000,
    dealPrice: 1_200_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxo9Sqqa/",
  },
  {
    images: ["/images/hero/balongsari.jpeg"],
    type: "Aset Lelang",
    title: "Apotek Strategis Surabaya",
    location: "Surabaya, Jawa Timur",
    desc: "Dihadang kuasa hukum debitur — eksekusi tetap berjalan, kunci tetap berpindah ke klien. Hemat Rp 2,1 miliar, karena tim hukum kami selalu satu langkah di depan setiap perlawanan.",
    marketPrice: 3_600_000_000,
    dealPrice: 1_500_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxoxe7Jc/",
  },
  {
    images: ["/images/hero/malang.jpg"],
    type: "Aset Lelang",
    title: "Rumah di Malang",
    location: "Malang, Jawa Timur",
    desc: "Hanya 30 hari. Belum balik nama, kunci sudah di tangan klien. Hemat Rp 640 juta — karena kami eksekusi di ritme klien, bukan di ritme birokrasi.",
    marketPrice: 1_000_000_000,
    dealPrice: 360_000_000,
    tiktokUrl: "https://vt.tiktok.com/ZSxoQ6s6P/",
  },
];

const SWIPE_THRESHOLD = 60;
const SWIPE_VELOCITY = 300;

const cardVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.98,
  }),
};

/* ────────── Odometer-style number counter ────────── */
const DiscountCounter: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value <= 0) {
      setDisplay(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    setDisplay(0);
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
};

const formatIDR = (n: number): string => {
  if (n >= 1_000_000_000) {
    const v = (n / 1_000_000_000)
      .toFixed(3)
      .replace(/\.?0+$/, "")
      .replace(".", ",");
    return `Rp ${v}M`;
  }
  if (n >= 1_000_000) {
    const v = (n / 1_000_000)
      .toFixed(2)
      .replace(/\.?0+$/, "")
      .replace(".", ",");
    return `Rp ${v}Jt`;
  }
  return `Rp ${n.toLocaleString("id-ID")}`;
};

const SuccessStories: React.FC = () => {
  const [[activeIdx, direction], setState] = useState<[number, number]>([0, 0]);
  const [imgIdx, setImgIdx] = useState(0);
  const total = stories.length;
  const active = stories[activeIdx];
  const discount = Math.round(
    ((active.marketPrice - active.dealPrice) / active.marketPrice) * 100
  );
  const savings = active.marketPrice - active.dealPrice;
  const safeImg = active.images[imgIdx] ?? active.images[0];

  // Discount color: orange → red, semakin besar % semakin merah.
  // 20% → hue ~30 (orange), 70%+ → hue ~0 (red).
  const dHue = Math.max(0, 30 - Math.min(30, (discount - 20) * 0.6));
  const dColor = `hsl(${dHue}, 92%, 58%)`;
  const dGradient = `linear-gradient(135deg, hsl(${dHue + 12}, 95%, 70%), hsl(${dHue}, 92%, 58%), hsl(${Math.max(
    0,
    dHue - 8
  )}, 88%, 48%))`;

  const goTo = useCallback(
    (next: number) => {
      const target = ((next % total) + total) % total;
      const dir = target > activeIdx ? 1 : -1;
      setState([target, dir]);
    },
    [activeIdx, total]
  );

  const next = useCallback(() => goTo(activeIdx + 1), [activeIdx, goTo]);
  const prev = useCallback(() => goTo(activeIdx - 1), [activeIdx, goTo]);

  // Reset gallery to first image when story changes
  useEffect(() => {
    setImgIdx(0);
  }, [activeIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return (
    <section className="relative w-full pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8 md:pb-10 overflow-hidden bg-[#070A12]">
      <AmbientBackdrop variant="emerald" />

      <div className="container relative z-10 mx-auto px-4 max-w-screen-xl">
        <div className="text-center">
          <PillLabel>Success Stories</PillLabel>
          <SectionTitle
            title={
              <>
                Project yang sudah{" "}
                <span className="bg-gradient-to-r from-[#86efac] to-teal-400 bg-clip-text text-transparent">
                  benar-benar selesai
                </span>
                .
              </>
            }
            subtitle="Bukan janji — dokumentasi nyata dari setiap aset yang berhasil kami tutup, lengkap dengan harga deal yang transparan."
          />
        </div>

        {/* Stage */}
        <div className="relative mt-8 sm:mt-10 max-w-6xl mx-auto">
          {/* Frame glow */}
          <div
            className="pointer-events-none absolute -inset-4 sm:-inset-6 rounded-[2.5rem] blur-3xl opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(52,211,153,0.18), transparent 65%)",
            }}
          />

          <div className="relative rounded-[1.75rem] sm:rounded-[2rem] p-[1px] bg-gradient-to-br from-emerald-400/40 via-white/[0.06] to-teal-400/30 overflow-hidden">
            <div className="relative rounded-[1.7rem] sm:rounded-[1.95rem] overflow-hidden bg-[#0B0F17]">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={activeIdx}
                  custom={direction}
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] },
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.5 },
                  }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={(_, info) => {
                    if (
                      info.offset.x < -SWIPE_THRESHOLD ||
                      info.velocity.x < -SWIPE_VELOCITY
                    ) {
                      next();
                    } else if (
                      info.offset.x > SWIPE_THRESHOLD ||
                      info.velocity.x > SWIPE_VELOCITY
                    ) {
                      prev();
                    }
                  }}
                  className="relative aspect-[4/5] sm:aspect-[16/11] md:aspect-[16/9] cursor-grab active:cursor-grabbing select-none"
                >
                  {/* Image crossfade gallery */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={imgIdx}
                      initial={{ opacity: 0, scale: 1.03 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={safeImg}
                        alt={active.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 1200px"
                        className="object-cover pointer-events-none"
                        priority={activeIdx === 0}
                        draggable={false}
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Cinematic gradients */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#05070D] via-[#05070D]/55 to-transparent" />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#05070D]/65 via-transparent to-transparent" />

                  {/* HUD grid overlay */}
                  <div
                    className="absolute inset-0 opacity-[0.04] pointer-events-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
                      backgroundSize: "48px 48px",
                    }}
                  />

                  {/* Top row: status + type */}
                  <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 flex items-start justify-between gap-3 pointer-events-none">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/15 backdrop-blur-md text-[10px] sm:text-[11px] tracking-[0.25em] uppercase font-bold text-white/90">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      Live Case
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 border border-emerald-400/35 backdrop-blur-md text-[10px] sm:text-[11px] tracking-[0.2em] uppercase font-bold text-white">
                      <Icon
                        icon="solar:tag-price-bold"
                        className="text-sm text-emerald-300"
                      />
                      {active.type}
                    </span>
                  </div>

                  {/* Ghost number */}
                  <div className="absolute top-1/2 right-4 sm:right-8 -translate-y-1/2 hidden md:block pointer-events-none">
                    <div className="text-[7rem] lg:text-[9rem] font-extrabold leading-none font-mono text-white/[0.07] tracking-tighter select-none">
                      {String(activeIdx + 1).padStart(2, "0")}
                    </div>
                  </div>

                  {/* Gallery thumbnails strip — upper-right, vertical (lg+ only) */}
                  {active.images.length > 1 && (
                    <div className="absolute hidden lg:flex top-24 right-6 flex-col items-end gap-2 z-10 pointer-events-auto">
                      <span className="text-[9px] tracking-[0.25em] uppercase font-mono font-bold text-white/40 mb-0.5">
                        {String(imgIdx + 1).padStart(2, "0")} /{" "}
                        {String(active.images.length).padStart(2, "0")}
                      </span>
                      {active.images.map((img, i) => (
                        <button
                          key={`${img}-${i}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setImgIdx(i);
                          }}
                          aria-label={`Foto ${i + 1}`}
                          className={`relative overflow-hidden rounded-lg transition-all duration-300 ${
                            i === imgIdx
                              ? "h-12 w-12 ring-2 ring-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.45)]"
                              : "h-10 w-10 ring-1 ring-white/20 hover:ring-white/50 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={img}
                            alt=""
                            fill
                            sizes="60px"
                            className="object-cover"
                          />
                          <div
                            className={`absolute inset-0 transition ${
                              i === imgIdx
                                ? "bg-emerald-400/10"
                                : "bg-[#05070D]/30"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Bottom content panel */}
                  <div className="absolute bottom-0 inset-x-0 p-5 sm:p-7 md:p-9 pointer-events-none">
                    <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-8">
                      {/* Left: content */}
                      <div className="flex-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] tracking-[0.22em] uppercase font-bold text-emerald-300/90">
                          <Icon
                            icon="solar:map-point-bold"
                            className="text-sm"
                          />
                          {active.location}
                        </div>
                        <h3 className="mt-2 text-white font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] leading-[1.05] tracking-tight">
                          {active.title}
                        </h3>
                        <p className="mt-3 text-white/75 text-[13px] sm:text-sm md:text-[15px] leading-relaxed max-w-xl">
                          {active.desc}
                        </p>

                        {/* Mobile-only: pricing inline (compact) */}
                        <div className="md:hidden mt-4 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="text-[9px] tracking-[0.2em] uppercase font-mono text-white/40">
                                Pasaran
                              </span>
                              <span className="text-sm font-bold text-white/55 line-through decoration-red-400/40">
                                {formatIDR(active.marketPrice)}
                              </span>
                            </div>
                            <Icon
                              icon="solar:arrow-right-bold"
                              className="text-emerald-400"
                            />
                            <div className="flex flex-col">
                              <span className="text-[9px] tracking-[0.2em] uppercase font-mono text-emerald-300">
                                Deal
                              </span>
                              <span className="text-sm font-extrabold text-white">
                                {formatIDR(active.dealPrice)}
                              </span>
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-400/[0.08] border border-emerald-400/35">
                            <span className="text-[9px] tracking-[0.22em] uppercase font-mono font-bold text-emerald-300/85">
                              Hemat
                            </span>
                            <span className="text-[13px] font-extrabold font-mono text-white tabular-nums">
                              {formatIDR(savings)}
                            </span>
                            <span className="h-3 w-px bg-emerald-400/30" />
                            <span
                              className="text-[13px] font-extrabold font-mono tabular-nums"
                              style={{ color: dColor }}
                            >
                              −<DiscountCounter value={discount} />%
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 flex items-center gap-3 flex-wrap">
                          {active.tiktokUrl && (
                            <a
                              href={active.tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pointer-events-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-full bg-white text-[#05070D] font-bold text-[13px] sm:text-sm hover:bg-emerald-300 transition-colors shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
                            >
                              <Icon
                                icon="ic:baseline-tiktok"
                                className="text-lg"
                              />
                              Tonton di TikTok
                              <Icon
                                icon="solar:arrow-right-up-bold"
                                className="text-base"
                              />
                            </a>
                          )}

                          {/* Inline gallery hint (sm + md, hidden on lg+) */}
                          {active.images.length > 1 && (
                            <div className="lg:hidden pointer-events-auto inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md">
                              {active.images.map((img, i) => (
                                <button
                                  key={`mini-${img}-${i}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setImgIdx(i);
                                  }}
                                  aria-label={`Foto ${i + 1}`}
                                  className={`relative h-7 w-7 sm:h-8 sm:w-8 rounded-md overflow-hidden transition-all duration-300 ${
                                    i === imgIdx
                                      ? "ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
                                      : "ring-1 ring-white/20 opacity-60 hover:opacity-100"
                                  }`}
                                >
                                  <Image
                                    src={img}
                                    alt=""
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                  />
                                </button>
                              ))}
                              <span className="text-[9px] tracking-[0.2em] uppercase font-mono font-bold text-white/55 ml-1 pr-1">
                                {String(imgIdx + 1).padStart(2, "0")}/
                                {String(active.images.length).padStart(2, "0")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: pricing panel (desktop) */}
                      <motion.div
                        key={`price-${activeIdx}`}
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{
                          delay: 0.15,
                          duration: 0.55,
                          ease: [0.21, 0.47, 0.32, 0.98],
                        }}
                        className="pointer-events-auto hidden md:block shrink-0 w-[280px] lg:w-[320px]"
                      >
                        <div className="relative rounded-2xl border border-white/10 bg-black/45 backdrop-blur-xl p-5 overflow-hidden">
                          {/* Corner ticks */}
                          <span className="pointer-events-none absolute top-2 left-2 h-2 w-2 border-l border-t border-emerald-400/50" />
                          <span className="pointer-events-none absolute top-2 right-2 h-2 w-2 border-r border-t border-emerald-400/50" />
                          <span className="pointer-events-none absolute bottom-2 left-2 h-2 w-2 border-l border-b border-emerald-400/50" />
                          <span className="pointer-events-none absolute bottom-2 right-2 h-2 w-2 border-r border-b border-emerald-400/50" />

                          {/* Discount headline */}
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] tracking-[0.28em] uppercase font-mono font-bold text-white/45">
                              Hemat
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] tracking-[0.22em] uppercase font-bold font-mono text-emerald-300/80">
                              <Icon
                                icon="solar:verified-check-bold"
                                className="text-xs"
                              />
                              Verified
                            </span>
                          </div>

                          <div className="mt-2 flex items-baseline gap-2">
                            <span
                              className="text-[3rem] lg:text-[3.5rem] font-extrabold leading-none font-mono tracking-tight tabular-nums"
                              style={{
                                background: dGradient,
                                WebkitBackgroundClip: "text",
                                backgroundClip: "text",
                                color: "transparent",
                              }}
                            >
                              <DiscountCounter value={discount} />%
                            </span>
                            <span className="text-[11px] tracking-[0.2em] uppercase font-bold text-white/45 -translate-y-1">
                              di bawah pasaran
                            </span>
                          </div>

                          {/* Divider with pulse */}
                          <div className="relative my-4 h-px w-full overflow-hidden bg-white/[0.08]">
                            <motion.div
                              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
                              animate={{ x: ["-100%", "300%"] }}
                              transition={{
                                duration: 3.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                repeatDelay: 1.2,
                              }}
                            />
                          </div>

                          {/* Numbers grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[9px] tracking-[0.22em] uppercase font-bold font-mono text-white/40">
                                Pasaran
                              </div>
                              <div className="mt-1 text-[15px] font-bold text-white/55 line-through decoration-red-400/45 decoration-[1.5px]">
                                {formatIDR(active.marketPrice)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[9px] tracking-[0.22em] uppercase font-bold font-mono text-emerald-300/85">
                                Deal Closed
                              </div>
                              <div className="mt-1 text-[17px] font-extrabold text-white tracking-tight">
                                {formatIDR(active.dealPrice)}
                              </div>
                            </div>
                          </div>

                          {/* Savings line */}
                          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                            <span className="text-[9px] tracking-[0.22em] uppercase font-bold font-mono text-white/40">
                              Penghematan
                            </span>
                            <span className="text-[13px] font-extrabold font-mono text-emerald-300">
                              {formatIDR(savings)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Story thumbnail rail */}
        <div className="mt-5 sm:mt-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto py-4 px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
            {stories.map((s, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={s.title}
                  onClick={() => goTo(i)}
                  aria-label={`Lihat ${s.title}`}
                  className={`group/thumb relative shrink-0 snap-center h-14 sm:h-16 w-24 sm:w-28 rounded-xl overflow-hidden transition-all duration-500 ${
                    isActive
                      ? "ring-2 ring-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.45)] scale-[1.04]"
                      : "ring-1 ring-white/15 opacity-55 hover:opacity-95 hover:ring-white/30"
                  }`}
                >
                  <Image
                    src={s.images[0]}
                    alt={s.title}
                    fill
                    sizes="120px"
                    className={`object-cover transition-[filter] duration-500 ${
                      isActive ? "" : "saturate-[0.7]"
                    }`}
                  />
                  <div
                    className={`absolute inset-0 transition-colors duration-500 ${
                      isActive
                        ? "bg-emerald-400/[0.06]"
                        : "bg-[#05070D]/30 group-hover/thumb:bg-[#05070D]/10"
                    }`}
                  />
                  {isActive && (
                    <span className="absolute bottom-1 left-1.5 text-[10px] font-mono font-extrabold text-white tracking-widest drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hint */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] tracking-[0.22em] uppercase font-bold text-white/30">
          <Icon icon="solar:hand-shake-bold" className="text-sm" />
          Geser, klik panah, atau panah keyboard
        </div>
      </div>
    </section>
  );
};

export default SuccessStories;
