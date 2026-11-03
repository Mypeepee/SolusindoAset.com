"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";
import { isOwner } from "@/lib/sessionJabatan";
import {
  DEFAULT_SUCCESS_STORIES,
  formatStoryPrice as formatIDR,
  type SuccessStory,
} from "@/lib/success-stories";
import { Icon } from "@iconify/react";
import { AmbientBackdrop, PillLabel, SectionTitle } from "./_shared";

const StoryEditor = dynamic(() => import("./StoryEditor"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[10002] -translate-x-1/2 rounded-full border border-emerald-300/20 bg-[#0b1018] px-5 py-3 text-sm text-emerald-300"
    >
      Menyiapkan formulir…
    </div>
  ),
});

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
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
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
  }, [value, reduceMotion]);

  return <>{display}</>;
};

const SuccessStories: React.FC = () => {
  const { data: session } = useSession();
  const canAdd = isOwner(session?.user);
  const reduceMotion = useReducedMotion();
  const [stories, setStories] = useState<SuccessStory[]>(
    DEFAULT_SUCCESS_STORIES,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [smallDevice, setSmallDevice] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const railInView = useInView(railRef, { amount: 0.4 });
  const selectedId = useRef<string | null>(null);
  const dataVersion = useRef(0);
  const nudge =
    smallDevice && railInView && !interacted && !reduceMotion && !editorOpen;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setSmallDevice(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const version = dataVersion.current;
    fetch("/api/about/stories", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (
          controller.signal.aborted ||
          dataVersion.current !== version ||
          !result?.stories?.length
        )
          return;
        setStories(result.stories);
        const index = result.stories.findIndex(
          (story: SuccessStory) => story.id === selectedId.current,
        );
        setState([Math.max(0, index), 0]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [[activeIdx, direction], setState] = useState<[number, number]>([0, 0]);
  const [imgIdx, setImgIdx] = useState(0);
  const total = stories.length;
  const active = stories[activeIdx];
  const discount = Math.round(
    ((active.marketPrice - active.dealPrice) / active.marketPrice) * 100,
  );
  const savings = active.marketPrice - active.dealPrice;
  const safeImg = active.images[imgIdx] ?? active.images[0];

  // Discount color: orange → red, semakin besar % semakin merah.
  // 20% → hue ~30 (orange), 70%+ → hue ~0 (red).
  const dHue = Math.max(0, 30 - Math.min(30, (discount - 20) * 0.6));
  const dColor = `hsl(${dHue}, 92%, 58%)`;
  const dGradient = `linear-gradient(135deg, hsl(${dHue + 12}, 95%, 70%), hsl(${dHue}, 92%, 58%), hsl(${Math.max(
    0,
    dHue - 8,
  )}, 88%, 48%))`;

  const goTo = useCallback(
    (next: number) => {
      const target = ((next % total) + total) % total;
      const dir = target > activeIdx ? 1 : -1;
      selectedId.current = stories[target].id;
      setInteracted(true);
      setState([target, dir]);
    },
    [activeIdx, total, stories],
  );

  const next = useCallback(() => goTo(activeIdx + 1), [activeIdx, goTo]);
  const prev = useCallback(() => goTo(activeIdx - 1), [activeIdx, goTo]);

  // Reset gallery to first image when story changes
  useEffect(() => {
    setImgIdx(0);
  }, [active.id]);

  useEffect(() => {
    const rail = railRef.current;
    const button = rail?.querySelector<HTMLElement>(
      `[data-story-index="${activeIdx}"]`,
    );
    if (!rail || !button) return;
    rail.scrollTo({
      left: Math.max(
        0,
        button.offsetLeft - (rail.clientWidth - button.clientWidth) / 2,
      ),
      behavior: reduceMotion || activeIdx === 0 ? "instant" : "smooth",
    });
  }, [activeIdx, active.id, reduceMotion]);

  const addStory = (story: SuccessStory) => {
    dataVersion.current++;
    selectedId.current = story.id;
    setStories((current) => [
      story,
      ...current.filter((item) => item.id !== story.id),
    ]);
    setState([0, 1]);
    setImgIdx(0);
    setInteracted(true);
    setEditorOpen(false);
  };

  return (
    <section
      id="success-stories"
      aria-label="Proyek yang sudah selesai"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          event.defaultPrevented ||
          (event.target as HTMLElement).closest(
            "input, textarea, select, button, a, [contenteditable]",
          )
        )
          return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          next();
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          prev();
        }
      }}
      className="relative w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 pt-6 sm:pt-8 md:pt-10 pb-6 sm:pb-8 md:pb-10 overflow-hidden bg-[#070A12]"
    >
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

        {canAdd && (
          <div className="mt-5 flex justify-center">
            <button
              id="add-success-story"
              type="button"
              onPointerEnter={() => {
                void import("./StoryEditor");
              }}
              onFocus={() => {
                void import("./StoryEditor");
              }}
              onClick={() => setEditorOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-5 text-sm font-bold text-emerald-300 transition-colors hover:bg-emerald-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              <Icon icon="solar:add-circle-bold" className="text-lg" />
              Tambah proyek selesai
            </button>
          </div>
        )}
        {editorOpen && (
          <StoryEditor
            onClose={() => setEditorOpen(false)}
            onSaved={addStory}
          />
        )}

        {/* Stage */}
        <div className="relative mt-6 sm:mt-8 max-w-6xl mx-auto">
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
                  key={active.id}
                  custom={direction}
                  variants={
                    reduceMotion
                      ? {
                          enter: { opacity: 1, x: 0, scale: 1 },
                          center: { opacity: 1, x: 0, scale: 1 },
                          exit: { opacity: 0, x: 0, scale: 1 },
                        }
                      : cardVariants
                  }
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: {
                      duration: reduceMotion ? 0 : 0.3,
                      ease: [0.21, 0.47, 0.32, 0.98],
                    },
                    opacity: { duration: reduceMotion ? 0.08 : 0.2 },
                    scale: { duration: reduceMotion ? 0 : 0.3 },
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
                  className="relative flex min-h-[500px] flex-col justify-end sm:min-h-[480px] md:min-h-[560px] lg:aspect-[16/9] cursor-grab active:cursor-grabbing select-none touch-pan-y"
                >
                  {/* Image crossfade gallery */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={imgIdx}
                      initial={{
                        opacity: reduceMotion ? 1 : 0,
                        scale: reduceMotion ? 1 : 1.03,
                      }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: reduceMotion ? 0.08 : 0.25,
                        ease: "easeOut",
                      }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={safeImg}
                        alt={active.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 1200px"
                        className="object-cover pointer-events-none"
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
                      Selesai & diserahterimakan
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

                  {/* Bottom content panel */}
                  <div className="relative mt-36 p-5 sm:p-7 md:p-9 pointer-events-none">
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
                        <h3 className="mt-2 text-white font-extrabold text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] break-words leading-[1.05] tracking-tight">
                          {active.title}
                        </h3>
                        <p className="mt-3 text-white/75 text-[13px] sm:text-sm md:text-[15px] leading-relaxed break-words max-w-xl">
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
                              {savings >= 0 ? "Hemat" : "Selisih"}
                            </span>
                            <span className="text-[13px] font-extrabold font-mono text-white tabular-nums">
                              {formatIDR(Math.abs(savings))}
                            </span>
                            <span className="h-3 w-px bg-emerald-400/30" />
                            <span
                              className="text-[13px] font-extrabold font-mono tabular-nums"
                              style={{ color: dColor }}
                            >
                              {discount >= 0 ? "−" : "+"}
                              <DiscountCounter value={Math.abs(discount)} />%
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
                            <div className="pointer-events-auto inline-flex max-w-full items-center gap-1.5 overflow-x-auto px-2 py-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md">
                              {active.images.map((img, i) => (
                                <button
                                  key={`mini-${img}-${i}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectedId.current = active.id;
                                    setInteracted(true);
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
                          delay: reduceMotion ? 0 : 0.1,
                          duration: reduceMotion ? 0 : 0.25,
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
                              {savings >= 0 ? "Hemat" : "Selisih"}
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
                              <DiscountCounter value={Math.abs(discount)} />%
                            </span>
                            <span className="text-[11px] tracking-[0.2em] uppercase font-bold text-white/45 -translate-y-1">
                              {discount >= 0
                                ? "di bawah pasaran"
                                : "di atas pasaran"}
                            </span>
                          </div>

                          {/* Divider with pulse */}
                          <div className="relative my-4 h-px w-full overflow-hidden bg-white/[0.08]">
                            <motion.div
                              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
                              animate={
                                reduceMotion
                                  ? { x: 0 }
                                  : { x: ["-100%", "300%"] }
                              }
                              transition={{
                                duration: 3.5,
                                repeat: reduceMotion ? 0 : Infinity,
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
                              {formatIDR(Math.abs(savings))}
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

        <div className="mx-auto mt-4 flex max-w-3xl items-center justify-between gap-3 px-1">
          <p
            className="text-xs tabular-nums text-white/50"
            aria-live="polite"
            aria-atomic="true"
          >
            {activeIdx + 1} / {total} proyek
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={prev}
              aria-label="Proyek sebelumnya"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/75 transition-colors hover:border-emerald-300/50 hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
            >
              <Icon icon="solar:arrow-left-bold" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Proyek berikutnya"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white/75 transition-colors hover:border-emerald-300/50 hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300"
            >
              <Icon icon="solar:arrow-right-bold" />
            </button>
          </div>
        </div>

        {/* The inner row centers only when it fits; overflowing rows start at item one. */}
        <div className="mx-auto mt-1 max-w-3xl">
          <div
            ref={railRef}
            aria-label="Pilih proyek"
            onPointerDownCapture={() => setInteracted(true)}
            onWheel={() => setInteracted(true)}
            onScroll={() => {
              if ((railRef.current?.scrollLeft || 0) > 3) setInteracted(true);
            }}
            className="relative overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-px-3 touch-pan-x [scrollbar-width:thin]"
          >
            <motion.div
              animate={nudge ? { x: [0, 12, 0] } : { x: 0 }}
              transition={
                nudge
                  ? {
                      duration: 1.4,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: "easeInOut",
                    }
                  : { duration: 0.15 }
              }
              className="flex w-max min-w-full items-center justify-center gap-2 px-3 py-4 sm:gap-3"
            >
              {stories.map((story, i) => (
                <button
                  key={story.id}
                  type="button"
                  data-story-index={i}
                  onClick={() => goTo(i)}
                  aria-label={`Lihat ${story.title}`}
                  aria-pressed={i === activeIdx}
                  className={`group/thumb relative h-14 w-24 shrink-0 snap-start overflow-hidden rounded-xl transition-[opacity,box-shadow] duration-200 sm:h-16 sm:w-28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 ${i === activeIdx ? "ring-2 ring-emerald-400 opacity-100" : "ring-1 ring-white/15 opacity-55 hover:opacity-100"}`}
                >
                  <Image
                    src={story.images[0]}
                    alt={story.title}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-4 pb-1 text-left text-[10px] font-bold text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </motion.div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-white/50">
          <motion.span
            aria-hidden="true"
            animate={nudge ? { x: [0, 5, 0] } : { x: 0 }}
            transition={{
              duration: 1.4,
              repeat: nudge ? Infinity : 0,
              repeatDelay: 3,
            }}
          >
            <Icon
              icon="solar:arrow-right-bold"
              className="text-sm text-emerald-300"
            />
          </motion.span>
          <span className="sm:hidden">Geser untuk melihat proyek lainnya</span>
          <span className="hidden sm:inline">
            Pilih proyek atau gunakan tombol panah
          </span>
        </div>
      </div>
    </section>
  );
};

export default SuccessStories;
