"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@iconify/react";

// Icon konsisten dengan halaman kategori di /properti/[slug]
const KATEGORI = [
  { value: "Rumah",           label: "Rumah",         icon: "solar:home-smile-bold-duotone",       accent: "emerald", hex: "#10b981" },
  { value: "Tanah",           label: "Tanah",         icon: "solar:map-point-wave-bold-duotone",   accent: "lime",    hex: "#84cc16" },
  { value: "Apartemen",       label: "Apartemen",     icon: "solar:city-bold-duotone",             accent: "sky",     hex: "#0ea5e9" },
  { value: "Ruko",            label: "Ruko",          icon: "solar:shop-bold-duotone",             accent: "orange",  hex: "#f97316" },
  { value: "Gudang",          label: "Gudang",        icon: "solar:box-bold-duotone",              accent: "amber",   hex: "#f59e0b" },
  { value: "Hotel dan Villa", label: "Villa & Hotel", icon: "solar:bed-bold-duotone",              accent: "pink",    hex: "#ec4899" },
  { value: "Toko",            label: "Toko",          icon: "solar:bag-heart-bold-duotone",        accent: "fuchsia", hex: "#d946ef" },
  { value: "Pabrik",          label: "Pabrik",        icon: "solar:garage-bold-duotone",           accent: "slate",   hex: "#64748b" },
];

interface LogLine {
  type: "log" | "saved" | "error" | "progress" | "done" | "cancelled";
  msg?: string;
  judul?: string;
  alamat_lengkap?: string | null;
  kota?: string;
  harga?: number;
  gambar?: string | null;
  totalSaved?: number;
  totalSkipped?: number;
  page?: number;
}

interface SavedItem {
  judul: string;
  alamat_lengkap: string | null;
  kota: string;
  harga: number;
  gambar: string | null;
}

function formatRp(n: number) {
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)} M`;
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(0)} Jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export default function ScrapePage() {
  const [kategori, setKategori] = useState("Rumah");
  // String-based input — supaya user bisa kosongkan field saat mengetik.
  // Nilai efektif dihitung lewat `startPage` (default 1 kalau kosong/invalid).
  const [startPageStr, setStartPageStr] = useState("1");
  const startPage = useMemo(() => {
    const n = parseInt(startPageStr, 10);
    return !isNaN(n) && n >= 1 ? n : 1;
  }, [startPageStr]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [isStopping, setIsStopping] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  // Reset stopping flag setelah job benar-benar selesai
  useEffect(() => {
    if (status === "done" || status === "error" || status === "idle") {
      setIsStopping(false);
    }
  }, [status]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const consumeStream = useCallback(
    async (signal: AbortSignal, body: { kategori: string; startPage: number }) => {
      try {
        const res = await fetch("/api/scrape/lelang", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
        });

        if (!res.ok || !res.body) {
          setStatus("error");
          setLogs((p) => [...p, { type: "error", msg: "Gagal terhubung ke server." }]);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const event: LogLine = JSON.parse(line.slice(5).trim());
              setLogs((p) => [...p, event]);

              if (event.type === "saved" && event.judul) {
                setSaved((p) =>
                  [
                    { judul: event.judul!, alamat_lengkap: event.alamat_lengkap ?? null, kota: event.kota!, harga: event.harga!, gambar: event.gambar ?? null },
                    ...p,
                  ].slice(0, 50),
                );
                setTotalSaved(event.totalSaved ?? 0);
              }
              if (event.type === "progress") {
                setCurrentPage(event.page ?? 0);
                setTotalSkipped(event.totalSkipped ?? 0);
                setTotalSaved(event.totalSaved ?? 0);
              }
              if (event.type === "done" || event.type === "cancelled") {
                setTotalSaved(event.totalSaved ?? 0);
                setTotalSkipped(event.totalSkipped ?? 0);
                setStatus("done");
              }
              if (event.type === "error") {
                setStatus("error");
              }
            } catch {}
          }
        }

        setStatus((cur) => (cur === "running" ? "done" : cur));
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setStatus("error");
          setLogs((p) => [...p, { type: "error", msg: e.message }]);
        }
      }
    },
    [],
  );

  const handleStart = () => {
    if (status === "running") return;

    setStatus("running");
    setLogs([]);
    setSaved([]);
    setTotalSaved(0);
    setTotalSkipped(0);
    setCurrentPage(startPage);

    const abort = new AbortController();
    abortRef.current = abort;
    consumeStream(abort.signal, { kategori, startPage });
  };

  const handleStop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      await fetch("/api/scrape/lelang/stop", { method: "POST" });
      // Status akan jadi "done" via event "cancelled" dari server
    } catch {
      setIsStopping(false);
    }
  };

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const r = await fetch("/api/scrape/lelang/status", { cache: "no-store" });
        if (aborted || !r.ok) return;
        const data = await r.json();
        if (data.running && data.job) {
          setKategori(data.job.kategori);
          setStartPageStr(String(data.job.startPage ?? 1));
          setStatus("running");
          setLogs([
            { type: "log", msg: `🔄 Reconnect ke job aktif (kategori: ${data.job.kategori}, halaman: ${data.job.currentPage})` },
          ]);
          setSaved([]);
          setTotalSaved(data.job.totalSaved ?? 0);
          setTotalSkipped(data.job.totalSkipped ?? 0);
          setCurrentPage(data.job.currentPage ?? 0);

          const abort = new AbortController();
          abortRef.current = abort;
          consumeStream(abort.signal, {
            kategori: data.job.kategori,
            startPage: data.job.startPage,
          });
        }
      } catch {}
    })();

    return () => {
      aborted = true;
      abortRef.current?.abort();
    };
  }, [consumeStream]);

  const isRunning = status === "running";
  const activeKategori = useMemo(() => KATEGORI.find((k) => k.value === kategori), [kategori]);

  return (
    <div className="min-h-screen bg-[#040608] relative overflow-hidden">
      {/* ── Ambient background glow ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[480px] h-[480px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute -top-20 right-0 w-[420px] h-[420px] rounded-full bg-fuchsia-500/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[360px] h-[360px] rounded-full bg-emerald-500/[0.05] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto p-4 md:p-8 space-y-6">

        {/* ──────────────────────────────────────────────────────── */}
        {/*  HERO                                                     */}
        {/* ──────────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent backdrop-blur-xl p-6 md:p-8 overflow-hidden">
          {/* shimmer line */}
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent" />

          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Logo */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-violet-500/30 blur-2xl rounded-full" />
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-purple-700 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.5)] ring-1 ring-white/20">
                <Icon icon="solar:ssd-round-bold-duotone" className="text-white text-3xl md:text-4xl drop-shadow-lg" />
              </div>
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-violet-300 tracking-[0.18em] uppercase">Auto Sync</span>
                </span>
                <span className="text-[10px] text-slate-500">·</span>
                <span className="text-[10px] text-slate-500 font-mono">lelang.go.id</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                Scrape Lelang
              </h1>
              <p className="text-sm text-slate-400 mt-1.5 leading-relaxed max-w-lg">
                Ambil data lelang langsung dari sumber resmi dan simpan otomatis ke database listing properti.
              </p>
            </div>

            {/* Live stats */}
            <div className="grid grid-cols-3 gap-2 md:gap-3 md:min-w-[400px]">
              <StatPill
                icon="solar:check-circle-bold-duotone"
                label="Tersimpan"
                value={totalSaved}
                color="emerald"
                pulse={isRunning && totalSaved > 0}
              />
              <StatPill
                icon="solar:skip-next-bold-duotone"
                label="Dilewati"
                value={totalSkipped}
                color="slate"
              />
              <StatPill
                icon="solar:book-bookmark-bold-duotone"
                label="Halaman"
                value={currentPage}
                color="violet"
                pulse={isRunning}
              />
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────── */}
        {/*  CONFIG CARD                                              */}
        {/* ──────────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-[#0a0d14] to-[#06080c] overflow-hidden">

          {/* Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Icon icon="solar:settings-bold-duotone" className="text-violet-400 text-lg" />
              <h2 className="text-sm font-bold text-white">Konfigurasi Scraping</h2>
            </div>
            {activeKategori && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                <Icon icon={activeKategori.icon} className="text-base" style={{ color: activeKategori.hex }} />
                <span className="text-xs font-medium text-white">{activeKategori.label}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-5 md:p-6 space-y-5">

            {/* Pilih Kategori */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">
                  Pilih Kategori Properti
                </p>
                <span className="text-[10px] text-slate-600">{KATEGORI.length} kategori</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {KATEGORI.map((k) => {
                  const active = kategori === k.value;
                  return (
                    <button
                      key={k.value}
                      onClick={() => !isRunning && setKategori(k.value)}
                      disabled={isRunning}
                      className={`group relative flex flex-col items-center gap-2.5 px-3 py-4 rounded-2xl border transition-all duration-200 overflow-hidden ${
                        active
                          ? "border-white/20 bg-white/[0.04]"
                          : "border-white/[0.06] bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.04]"
                      } ${isRunning ? "cursor-not-allowed opacity-50" : "cursor-pointer"} active:scale-[0.97]`}
                      style={active ? { boxShadow: `0 0 32px ${k.hex}25, inset 0 0 0 1px ${k.hex}30` } : {}}
                    >
                      {/* Glow ring saat active */}
                      {active && (
                        <span
                          className="absolute -inset-px rounded-2xl opacity-50 blur-md pointer-events-none"
                          style={{ background: `radial-gradient(circle at 50% 0%, ${k.hex}40 0%, transparent 70%)` }}
                        />
                      )}

                      {/* Icon container */}
                      <div
                        className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                          active ? "scale-110" : "group-hover:scale-105"
                        }`}
                        style={{
                          background: active
                            ? `linear-gradient(135deg, ${k.hex}30 0%, ${k.hex}08 100%)`
                            : "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
                          border: `1px solid ${active ? `${k.hex}50` : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        <Icon
                          icon={k.icon}
                          className="text-2xl transition-colors duration-200"
                          style={{ color: active ? k.hex : "rgba(148, 163, 184, 0.7)" }}
                        />
                      </div>

                      {/* Label */}
                      <span
                        className={`relative text-xs font-bold transition-colors duration-200 ${
                          active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                        }`}
                      >
                        {k.label}
                      </span>

                      {/* Checkmark saat active */}
                      {active && (
                        <span
                          className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: k.hex }}
                        >
                          <Icon icon="solar:check-bold" className="text-[10px] text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start page + Action */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">

              {/* Page input */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Icon icon="solar:book-2-bold-duotone" className="text-violet-300 text-base" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Mulai Halaman</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => !isRunning && setStartPageStr(String(Math.max(1, startPage - 1)))}
                      disabled={isRunning || startPage <= 1}
                      className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-30 transition-colors"
                    >
                      <Icon icon="solar:minus-circle-bold" className="text-[10px] text-slate-300" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={startPageStr}
                      placeholder="1"
                      onChange={(e) => {
                        // Hanya digit, dan strip leading zero (tidak boleh "0" sebagai awalan)
                        let v = e.target.value.replace(/\D/g, "");
                        v = v.replace(/^0+/, "");
                        setStartPageStr(v);
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        // Restore ke "1" kalau dibiarkan kosong saat kehilangan fokus
                        if (startPageStr === "") setStartPageStr("1");
                      }}
                      disabled={isRunning}
                      className="w-14 bg-transparent text-center text-white text-base font-black focus:outline-none placeholder:text-slate-600"
                    />
                    <button
                      onClick={() => !isRunning && setStartPageStr(String(startPage + 1))}
                      disabled={isRunning}
                      className="w-5 h-5 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-30 transition-colors"
                    >
                      <Icon icon="solar:add-circle-bold" className="text-[10px] text-slate-300" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action button */}
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="group relative flex-1 overflow-hidden rounded-2xl p-[1.5px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-600 shadow-[0_0_28px_rgba(168,85,247,0.45)] hover:shadow-[0_0_42px_rgba(168,85,247,0.65)] transition-all duration-300 active:scale-[0.98]"
                >
                  <div className="relative flex items-center justify-center gap-2.5 py-3 px-5 rounded-[14px] bg-[#06080c] group-hover:bg-[#0a0d14] transition-colors">
                    <Icon icon="solar:play-circle-bold" className="text-xl text-violet-300 group-hover:text-violet-200 group-hover:scale-110 transition-all" />
                    <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-violet-200 via-fuchsia-200 to-purple-200 bg-clip-text text-transparent">
                      Mulai Scraping
                    </span>
                    <Icon icon="solar:arrow-right-bold" className="text-base text-fuchsia-300 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  disabled={isStopping}
                  className={`group relative flex-1 overflow-hidden rounded-2xl border transition-all duration-300 active:scale-[0.98] ${
                    isStopping
                      ? "border-amber-500/40 bg-gradient-to-r from-amber-600/15 via-orange-500/15 to-amber-600/15 cursor-wait"
                      : "border-red-500/40 bg-gradient-to-r from-red-600/20 via-rose-500/20 to-red-600/20 hover:border-red-400/70 shadow-[0_0_24px_rgba(244,63,94,0.3)] hover:shadow-[0_0_36px_rgba(244,63,94,0.5)]"
                  }`}
                >
                  {isStopping ? (
                    <div className="flex items-center justify-center gap-2.5 py-3 px-5">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="rgba(251,191,36,0.25)" strokeWidth="3" />
                        <path d="M21 12a9 9 0 0 0-9-9" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span className="text-sm font-bold text-amber-100">Menghentikan...</span>
                      <span className="hidden sm:inline-flex items-center text-[10px] font-mono text-amber-300/70 ml-1">
                        tunggu sebentar
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2.5 py-3 px-5">
                      <span className="relative flex items-center justify-center w-5 h-5">
                        <span className="absolute inset-0 rounded-full bg-red-400/30 animate-ping" />
                        <Icon icon="solar:stop-circle-bold" className="relative text-xl text-red-300" />
                      </span>
                      <span className="text-sm font-bold text-red-100">Hentikan Scraping</span>
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────── */}
        {/*  STATUS BANNER (running / done)                           */}
        {/* ──────────────────────────────────────────────────────── */}
        {isRunning && (
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/[0.08] via-fuchsia-500/[0.05] to-violet-500/[0.08]">
            {/* Animated progress sweep */}
            <div className="absolute inset-y-0 left-0 w-full opacity-40">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-violet-400/30 to-transparent animate-[shimmer_2s_infinite]" />
            </div>

            <div className="relative flex items-center gap-4 px-5 py-4">
              {/* Spinner */}
              <div className="relative shrink-0">
                <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="3"
                    strokeDasharray="22 66"
                    strokeLinecap="round"
                    className="animate-spin origin-center [transform-origin:18px_18px]"
                  />
                </svg>
                <Icon icon="solar:ssd-round-bold-duotone" className="absolute inset-0 m-auto text-violet-300 text-base" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-violet-300 uppercase tracking-[0.16em]">Sedang Berjalan</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-violet-500/15 text-violet-300 border border-violet-500/25">LIVE</span>
                </div>
                <p className="text-sm text-white font-semibold">
                  Mengambil <span className="text-violet-300">{kategori}</span> dari halaman <span className="text-fuchsia-300">{currentPage}</span>
                </p>
              </div>

              <button
                onClick={handleStop}
                disabled={isStopping}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  isStopping
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300 cursor-wait"
                    : "bg-red-500/10 hover:bg-red-500/20 border-red-500/30 hover:border-red-400/60 text-red-300"
                }`}
              >
                {isStopping ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="rgba(251,191,36,0.25)" strokeWidth="3" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Menghentikan...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:stop-bold" className="text-sm" />
                    Stop
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.04] to-transparent">
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-md animate-pulse" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_0_18px_rgba(16,185,129,0.5)]">
                  <Icon icon="solar:check-circle-bold" className="text-white text-xl" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-[0.16em] mb-0.5">Selesai</div>
                <p className="text-sm text-white">
                  <span className="font-bold text-emerald-300">{totalSaved}</span> listing tersimpan,{" "}
                  <span className="font-bold text-slate-300">{totalSkipped}</span> dilewati (sudah ada)
                </p>
              </div>
              <Icon icon="solar:confetti-bold-duotone" className="hidden sm:block text-3xl text-emerald-400/80" />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.05] px-5 py-4 flex items-center gap-3">
            <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-400 text-2xl shrink-0" />
            <div>
              <div className="text-[10px] font-bold text-red-300 uppercase tracking-[0.16em] mb-0.5">Terjadi Kesalahan</div>
              <p className="text-sm text-white">Periksa log terminal di bawah untuk detail lengkap.</p>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/*  LOG + RESULTS                                            */}
        {/* ──────────────────────────────────────────────────────── */}
        {logs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Terminal */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-[#04060a] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 ring-1 ring-red-500/30" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 ring-1 ring-yellow-500/30" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 ring-1 ring-emerald-500/30" />
                </div>
                <span className="text-xs text-slate-500 font-mono">scrape.log</span>
                <span className="ml-auto text-[10px] text-slate-600 font-mono">{logs.length} lines</span>
              </div>

              <div className="h-96 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded">
                {logs.map((l, i) => {
                  const color =
                    l.type === "error"     ? "text-red-400" :
                    l.type === "saved"     ? "text-emerald-400" :
                    l.type === "done"      ? "text-violet-300 font-bold" :
                    l.type === "cancelled" ? "text-orange-400" :
                    l.type === "progress"  ? "text-sky-400" :
                                             "text-slate-400";
                  const prefix =
                    l.type === "error"     ? "✖" :
                    l.type === "saved"     ? "✓" :
                    l.type === "done"      ? "★" :
                    l.type === "cancelled" ? "⊘" :
                    l.type === "progress"  ? "▸" :
                                             "·";
                  return (
                    <div key={i} className={`flex gap-2 ${color}`}>
                      <span className="text-slate-700 select-none w-6 text-right shrink-0">{i + 1}</span>
                      <span className="opacity-60 shrink-0">{prefix}</span>
                      <span className="break-words min-w-0">{l.msg}</span>
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>

            {/* Saved items */}
            <div className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-[#06080c] overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Icon icon="solar:check-circle-bold-duotone" className="text-emerald-400 text-base" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">Baru Tersimpan</h3>
                    <p className="text-[10px] text-slate-500 leading-tight">Realtime preview</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
                  {totalSaved} listing
                </span>
              </div>

              <div className="h-96 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded">
                {saved.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600 px-6 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-violet-500/10 blur-xl rounded-full" />
                      <Icon icon="solar:hourglass-line-bold-duotone" className="relative text-5xl text-violet-500/40" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-400">Menunggu data...</p>
                      <p className="text-xs text-slate-600 mt-0.5">Listing akan muncul di sini saat tersimpan</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {saved.map((item, i) => (
                      <div
                        key={i}
                        className="group flex items-center gap-3.5 px-5 py-3 hover:bg-white/[0.025] transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                          {item.gambar ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.gambar}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                            </>
                          ) : (
                            <Icon icon={activeKategori?.icon ?? "solar:home-2-bold-duotone"} className="text-slate-600 text-xl" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-emerald-200 transition-colors">
                            {item.alamat_lengkap || item.judul}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                              <Icon icon="solar:map-point-bold" className="text-slate-500 text-xs" />
                              {item.kota}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                            <span className="text-[11px] font-extrabold text-emerald-400">{formatRp(item.harga)}</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                          <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-xs" />
                          <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">Saved</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/*  EMPTY STATE                                              */}
        {/* ──────────────────────────────────────────────────────── */}
        {logs.length === 0 && status === "idle" && (
          <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent py-16 px-6">
            <div className="flex flex-col items-center text-center max-w-md mx-auto gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full" />
                <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-purple-700/20 border border-violet-500/30 flex items-center justify-center">
                  <Icon icon="solar:ssd-round-bold-duotone" className="text-5xl text-violet-300" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center ring-4 ring-[#040608] shadow-lg">
                  <Icon icon="solar:bolt-bold" className="text-white text-sm" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white">Siap memulai scraping</h2>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  Pilih kategori properti di atas lalu tekan{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-mono text-xs border border-violet-500/30">
                    Mulai Scraping
                  </span>
                  . Data akan tersinkron langsung ke database listing.
                </p>
              </div>

              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                <Icon icon="solar:shield-check-bold-duotone" className="text-emerald-400 text-base" />
                <span>Duplikat otomatis dilewati</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Local keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

// ─── StatPill ──────────────────────────────────────────────────────
function StatPill({
  icon,
  label,
  value,
  color,
  pulse = false,
}: {
  icon: string;
  label: string;
  value: number;
  color: "emerald" | "slate" | "violet";
  pulse?: boolean;
}) {
  const colors = {
    emerald: { bg: "from-emerald-500/15 to-emerald-500/5", border: "border-emerald-500/25", icon: "text-emerald-400", text: "text-emerald-300" },
    slate:   { bg: "from-slate-500/10 to-slate-500/5",     border: "border-slate-500/20",   icon: "text-slate-400",   text: "text-slate-300"   },
    violet:  { bg: "from-violet-500/15 to-violet-500/5",   border: "border-violet-500/25",  icon: "text-violet-400",  text: "text-violet-300"  },
  }[color];

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${colors.border} bg-gradient-to-b ${colors.bg} px-3 py-3`}>
      {pulse && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse" />}
      <div className="flex items-center gap-1.5 mb-1">
        <Icon icon={icon} className={`${colors.icon} text-sm`} />
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.14em]">{label}</span>
      </div>
      <div className={`text-2xl md:text-3xl font-black ${colors.text} tabular-nums leading-none`}>{value}</div>
    </div>
  );
}
