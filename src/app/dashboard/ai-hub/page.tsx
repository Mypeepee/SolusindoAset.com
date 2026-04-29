"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useScraper } from "@/app/dashboard/components/scraper-context";
import type { ScraperStatus, CatState, LogEntry } from "@/app/dashboard/components/scraper-context";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ApiService = {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: "emerald" | "cyan" | "violet" | "amber" | "rose" | "sky";
  active: boolean;
  requests: number;
  latency: string;
};

type SuratTpl = {
  id: string;
  label: string;
  icon: string;
  desc: string;
  color: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────────────────────────────────────

const KATEGORI_OPTIONS = [
  { value: "Rumah",          label: "Rumah",          icon: "solar:home-bold-duotone" },
  { value: "Apartemen",      label: "Apartemen",      icon: "solar:buildings-2-bold-duotone" },
  { value: "Ruko",           label: "Ruko",           icon: "solar:shop-bold-duotone" },
  { value: "Tanah",          label: "Tanah",          icon: "solar:map-bold-duotone" },
  { value: "Gudang",         label: "Gudang",         icon: "solar:box-bold-duotone" },
  { value: "Hotel dan Villa",label: "Hotel & Villa",  icon: "solar:bed-bold-duotone" },
  { value: "Toko",           label: "Toko",           icon: "solar:bag-bold-duotone" },
  { value: "Pabrik",         label: "Pabrik",         icon: "solar:factory-bold-duotone" },
];

const INITIAL_APIS: ApiService[] = [
  { id: "surat",     label: "Generate Surat",       desc: "Buat dokumen hukum otomatis via AI",        icon: "solar:document-text-bold-duotone",      color: "emerald", active: true,  requests: 142, latency: "~1.2s" },
  { id: "ocr",       label: "OCR Parser",            desc: "Ekstrak teks dari KTP, kwitansi, AJB",      icon: "solar:scanner-bold-duotone",             color: "cyan",    active: true,  requests: 89,  latency: "~0.8s" },
  { id: "image",     label: "Image Processor",       desc: "Resize, watermark & thumbnail properti",    icon: "solar:gallery-wide-bold-duotone",        color: "sky",     active: false, requests: 34,  latency: "~0.6s" },
  { id: "valuation", label: "Valuasi AI",            desc: "Estimasi harga pasar berbasis ML",          icon: "solar:graph-up-bold-duotone",            color: "violet",  active: false, requests: 0,   latency: "~3.1s" },
  { id: "notif",     label: "WhatsApp Notif",        desc: "Kirim notifikasi WA otomatis ke klien",     icon: "solar:chat-square-like-bold-duotone",    color: "amber",   active: true,  requests: 511, latency: "~0.4s" },
  { id: "email",     label: "Email Blast",           desc: "Kirim newsletter & penawaran massal",       icon: "solar:letter-bold-duotone",              color: "rose",    active: false, requests: 27,  latency: "~1.0s" },
];

const SURAT_TPLS: SuratTpl[] = [
  { id: "penawaran",  label: "Surat Penawaran",     icon: "solar:document-add-bold-duotone",      desc: "Penawaran properti ke calon pembeli",       color: "emerald" },
  { id: "perjanjian", label: "PPJB / AJB Draft",   icon: "solar:file-check-bold-duotone",         desc: "Perjanjian Pengikatan Jual Beli dasar",     color: "cyan"    },
  { id: "kuasa",      label: "Surat Kuasa",         icon: "solar:shield-user-bold-duotone",        desc: "Kuasa jual / kuasa beli properti",          color: "violet"  },
  { id: "kwitansi",   label: "Kwitansi",            icon: "solar:receipt-bold-duotone",            desc: "Bukti pembayaran DP / pelunasan",           color: "amber"   },
  { id: "somasi",     label: "Surat Somasi",        icon: "solar:danger-triangle-bold-duotone",    desc: "Teguran hukum formal",                      color: "rose"    },
  { id: "pernyataan", label: "Surat Pernyataan",   icon: "solar:pen-new-square-bold-duotone",     desc: "Pernyataan kepemilikan / kondisi aset",     color: "sky"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const clr = {
  emerald: { text: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-400/25", glow: "shadow-[0_0_20px_rgba(16,185,129,0.25)]", dot: "bg-emerald-400", ring: "ring-emerald-400/40" },
  cyan:    { text: "text-cyan-300",    bg: "bg-cyan-500/10",    border: "border-cyan-400/25",    glow: "shadow-[0_0_20px_rgba(6,182,212,0.25)]",   dot: "bg-cyan-400",    ring: "ring-cyan-400/40"    },
  violet:  { text: "text-violet-300",  bg: "bg-violet-500/10",  border: "border-violet-400/25",  glow: "shadow-[0_0_20px_rgba(139,92,246,0.25)]",  dot: "bg-violet-400",  ring: "ring-violet-400/40"  },
  amber:   { text: "text-amber-300",   bg: "bg-amber-500/10",   border: "border-amber-400/25",   glow: "shadow-[0_0_20px_rgba(251,191,36,0.25)]",  dot: "bg-amber-400",   ring: "ring-amber-400/40"   },
  rose:    { text: "text-rose-300",    bg: "bg-rose-500/10",    border: "border-rose-400/25",    glow: "shadow-[0_0_20px_rgba(251,113,133,0.25)]", dot: "bg-rose-400",    ring: "ring-rose-400/40"    },
  sky:     { text: "text-sky-300",     bg: "bg-sky-500/10",     border: "border-sky-400/25",     glow: "shadow-[0_0_20px_rgba(56,189,248,0.25)]",  dot: "bg-sky-400",     ring: "ring-sky-400/40"     },
};

const logStyle = {
  info:    { text: "text-slate-400",    prefix: "INFO " },
  success: { text: "text-emerald-400",  prefix: "OK   " },
  warn:    { text: "text-amber-400",    prefix: "WARN " },
  error:   { text: "text-rose-400",     prefix: "ERR  " },
};

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type AgentOption = { id_agent: string; nama_lengkap: string };

export default function AiHubPage() {
  // ── Scraper state dari context global (persists across navigation) ──
  const { catStates, logs, anyRunning, totalSaved, totalSkip,
          runScraper: ctxRunScraper, stopScraper, resetAll, pushLog, clearLogs } = useScraper();

  // ── Scraper config (lokal — hanya config UI) ──
  const [selectedAgent, setSelectedAgent] = useState("");
  const [maxPages, setMaxPages]           = useState<number | "">("");
  const [agents, setAgents]               = useState<AgentOption[]>([]);

  // ── API state ──
  const [apis, setApis] = useState<ApiService[]>(INITIAL_APIS);

  // ── Surat generator state ──
  const [selectedTpl, setSelectedTpl]   = useState<string | null>(null);
  const [suratInput, setSuratInput]     = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [suratResult, setSuratResult]   = useState<string | null>(null);

  // ── Log scroll ──
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // ── Fetch agents on mount ──
  useEffect(() => {
    fetch("/api/dashboard/hrm")
      .then((r) => r.json())
      .then((j) => {
        const list: AgentOption[] = (j.agents || []).map((a: any) => ({
          id_agent: a.id_agent,
          nama_lengkap: a.nama_lengkap,
        }));
        setAgents(list);
        if (list.length > 0) setSelectedAgent(list[0].id_agent);
      })
      .catch(() => {});
  }, []);

  // ── Wrapper — kirim config ke context ──
  const runScraper = (targets: string[] | null) => {
    if (anyRunning && !targets) return;
    ctxRunScraper(targets, selectedAgent, maxPages);
  };

  // ── API toggle ──
  const toggleApi = (id: string) => {
    setApis((p) =>
      p.map((a) => {
        if (a.id !== id) return a;
        return { ...a, active: !a.active };
      })
    );
  };

  // ── Surat generator ──
  const generateSurat = async () => {
    if (!selectedTpl || !suratInput.trim() || isGenerating) return;
    setIsGenerating(true);
    setSuratResult(null);
    const tpl = SURAT_TPLS.find((t) => t.id === selectedTpl)!;
    pushLog({ type: "info", msg: `Generating ${tpl.label}...` });
    await new Promise((r) => setTimeout(r, 2400));
    pushLog({ type: "success", msg: `${tpl.label} berhasil digenerate oleh AI ✓` });
    setSuratResult(
      `${tpl.label.toUpperCase()}\n${"─".repeat(48)}\n\nBerdasarkan informasi:\n"${suratInput}"\n\nDokumen ini telah digenerate secara otomatis oleh sistem AI.\nSilakan tinjau dan sesuaikan sebelum ditandatangani.\n\n[Tanda Tangan]\n\n_________________________\nPihak Pertama\n\n\n_________________________\nPihak Kedua`
    );
    setIsGenerating(false);
  };

  // ── Computed ──
  const activeApiCount = apis.filter((a) => a.active).length;
  const totalRequests  = apis.reduce((s, a) => s + a.requests, 0);

  return (
    <div className="relative min-h-screen bg-[#020617]">

      {/* ════════ Background ════════ */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#030d1f] to-[#020617]" />
        <div className="absolute -right-48 -top-48 h-[500px] w-[500px] rounded-full bg-emerald-500/15 blur-[140px]" />
        <div className="absolute -left-48 bottom-0 h-96 w-96 rounded-full bg-violet-500/12 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/8 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#22c55e_1px,transparent_1px),linear-gradient(to_bottom,#22c55e_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">

        {/* ════════ Hero Header ════════ */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Brand */}
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
              <Icon icon="solar:cpu-bolt-bold-duotone" className="text-3xl text-emerald-300" />
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
              </span>
            </div>
            <div>
              <h1 className="text-[1.6rem] font-bold tracking-tight text-white leading-tight">
                AI{" "}
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                  Control Hub
                </span>
              </h1>
              <p className="text-sm text-slate-400">Otomasi & kecerdasan buatan untuk operasional properti</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-2.5">
            <HeroStat icon="solar:cpu-linear"        value={`${activeApiCount}/${apis.length}`} label="API Aktif"        color="emerald" />
            <HeroStat icon="solar:graph-up-linear"   value={totalRequests.toLocaleString()}    label="Total Request"   color="cyan"    />
            <HeroStat icon="solar:database-linear"   value={String(totalSaved)}               label="Tersimpan Sesi Ini" color="violet" />
          </div>
        </motion.div>

        {/* ════════ Main 3-col grid ════════ */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ── Col 1: Scraper Lelang ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-[#060d1a]/80 p-6 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/12 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <Icon icon="solar:radar-2-bold-duotone" className="text-2xl text-emerald-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Scraper Lelang</p>
                  <p className="text-[11px] text-slate-500">lelang.go.id → database, semua kategori paralel</p>
                </div>
              </div>
              {anyRunning ? (
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <motion.span className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                  {Object.values(catStates).filter(c => c.status === "running").length} Berjalan
                </span>
              ) : (
                <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                  Standby
                </span>
              )}
            </div>

            {/* Agent + max pages */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agent</p>
                <select
                  disabled={anyRunning}
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0a1628] px-3 py-2 text-[11px] text-slate-200 focus:border-emerald-400/40 focus:outline-none disabled:opacity-50"
                >
                  {agents.length === 0 && <option value="">Memuat...</option>}
                  {agents.map((a) => (
                    <option key={a.id_agent} value={a.id_agent}>{a.nama_lengkap}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Maks. Halaman</p>
                <input
                  type="number" min={1} placeholder="Semua"
                  disabled={anyRunning} value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-[#0a1628] px-3 py-2 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-emerald-400/40 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Grid kategori */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Kategori & Status</p>
              <div className="grid grid-cols-2 gap-1.5">
                {KATEGORI_OPTIONS.map((k) => {
                  const cs  = catStates[k.value] ?? { status: "idle", saved: 0, skip: 0 };
                  const isR = cs.status === "running";
                  const isD = cs.status === "done";
                  const isE = cs.status === "error";
                  return (
                    <div
                      key={k.value}
                      className={`flex items-center justify-between rounded-xl border px-2.5 py-2 transition-all ${
                        isR ? "border-emerald-400/35 bg-emerald-500/8"
                        : isD ? "border-cyan-400/25 bg-cyan-500/6"
                        : isE ? "border-rose-400/25 bg-rose-500/6"
                        : "border-white/8 bg-white/3"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Icon icon={k.icon} className={`shrink-0 text-sm ${isR ? "text-emerald-400" : isD ? "text-cyan-400" : isE ? "text-rose-400" : "text-slate-500"}`} />
                        <span className="truncate text-[11px] font-medium text-slate-200">{k.label}</span>
                      </div>
                      <div className="ml-1 flex shrink-0 items-center gap-1">
                        {isR && (
                          <motion.span className="font-mono text-[10px] font-bold text-emerald-300"
                            key={cs.saved} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            {cs.saved}
                          </motion.span>
                        )}
                        {isD && <span className="font-mono text-[10px] font-bold text-cyan-300">✓{cs.saved}</span>}
                        {isE && <span className="text-[10px] font-bold text-rose-400">ERR</span>}
                        {isR ? (
                          <motion.span className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                        ) : isD ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        ) : isE ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                        )}
                        {isR ? (
                          <button onClick={() => stopScraper(k.value)}
                            className="ml-0.5 rounded-md border border-rose-400/30 bg-rose-500/10 p-0.5 text-[9px] text-rose-300 hover:bg-rose-500/20">
                            <Icon icon="solar:stop-bold" />
                          </button>
                        ) : (
                          <button onClick={() => runScraper([k.value])}
                            disabled={!selectedAgent}
                            className="ml-0.5 rounded-md border border-white/10 bg-white/5 p-0.5 text-[9px] text-slate-400 hover:bg-emerald-500/15 hover:text-emerald-300 disabled:opacity-30">
                            <Icon icon="solar:play-bold" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total stats */}
            <div className="flex gap-2">
              <div className="flex flex-1 items-center justify-between rounded-xl border border-emerald-400/15 bg-emerald-500/8 px-3 py-1.5">
                <span className="text-[10px] text-slate-500">Total Disimpan</span>
                <motion.span key={totalSaved} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="font-mono text-sm font-bold text-emerald-300">{totalSaved}</motion.span>
              </div>
              <div className="flex flex-1 items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3 py-1.5">
                <span className="text-[10px] text-slate-500">Dilewati</span>
                <span className="font-mono text-sm font-bold text-slate-400">{totalSkip}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              {anyRunning ? (
                <button onClick={() => stopScraper()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500/12 py-2.5 text-[13px] font-semibold text-rose-200 transition-all hover:bg-rose-500/22">
                  <Icon icon="solar:stop-bold" className="text-base" />
                  Hentikan Semua
                </button>
              ) : (
                <button onClick={() => runScraper(null)} disabled={!selectedAgent}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/12 py-2.5 text-[13px] font-semibold text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.2)] transition-all hover:bg-emerald-500/22 hover:shadow-[0_0_36px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-40">
                  <Icon icon="solar:play-bold" className="text-base" />
                  Jalankan Semua
                </button>
              )}
              <IconBtn icon="solar:restart-linear" onClick={resetAll} title="Reset" />
            </div>
          </motion.div>

          {/* ── Col 2: API Services ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-[#060d1a]/80 p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/12 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <Icon icon="solar:settings-minimalistic-bold-duotone" className="text-2xl text-cyan-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">API Services</p>
                <p className="text-[11px] text-slate-500">Toggle layanan aktif / non-aktif</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {apis.map((api, i) => {
                const c = clr[api.color];
                return (
                  <motion.div
                    key={api.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.055 }}
                    className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-all duration-200 ${
                      api.active
                        ? `border-white/10 bg-white/4 ${api.active ? c.glow : ""}`
                        : "border-white/5 bg-transparent"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${c.bg} ${c.border}`}>
                      <Icon icon={api.icon} className={`text-lg ${c.text} ${api.active ? "" : "opacity-40"}`} />
                    </div>
                    <div className={`min-w-0 flex-1 transition-opacity ${api.active ? "opacity-100" : "opacity-40"}`}>
                      <p className="truncate text-[12px] font-semibold text-slate-100">{api.label}</p>
                      <p className="truncate text-[10px] text-slate-500">{api.desc}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Toggle on={api.active} color={api.color} onChange={() => toggleApi(api.id)} />
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono ${api.active ? "text-slate-500" : "text-slate-700"}`}>
                          {api.requests.toLocaleString()}
                        </span>
                        <span className={`text-[10px] ${api.active ? c.text : "text-slate-700"}`}>{api.latency}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-auto flex items-center justify-between rounded-2xl border border-white/5 bg-white/3 px-4 py-2.5">
              <span className="text-[11px] text-slate-500">Total request bulan ini</span>
              <span className="font-mono text-sm font-bold text-emerald-300">{totalRequests.toLocaleString()}</span>
            </div>
          </motion.div>

          {/* ── Col 3: AI Surat Generator ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4 rounded-3xl border border-white/8 bg-[#060d1a]/80 p-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/12 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                <Icon icon="solar:magic-stick-3-bold-duotone" className="text-2xl text-violet-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">AI Surat Generator</p>
                <p className="text-[11px] text-slate-500">Dokumen hukum properti instan</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SURAT_TPLS.map((tpl) => {
                const c = clr[tpl.color as keyof typeof clr];
                const active = selectedTpl === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => { setSelectedTpl(tpl.id); setSuratResult(null); }}
                    className={`group flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-all duration-200 ${
                      active
                        ? `${c.border} ${c.bg} ${c.glow}`
                        : "border-white/7 bg-white/3 hover:border-white/14 hover:bg-white/5"
                    }`}
                  >
                    <Icon icon={tpl.icon} className={`text-xl transition-colors ${active ? c.text : "text-slate-500 group-hover:" + c.text}`} />
                    <p className="text-[11px] font-semibold leading-snug text-slate-100">{tpl.label}</p>
                    <p className="text-[10px] leading-tight text-slate-500">{tpl.desc}</p>
                  </button>
                );
              })}
            </div>

            <textarea
              rows={3}
              placeholder="Deskripsikan detail... (nama pihak, alamat, nilai transaksi, tanggal, dll)"
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-[12px] text-slate-100 placeholder:text-slate-600 focus:border-violet-400/40 focus:outline-none focus:ring-1 focus:ring-violet-400/25 transition-all"
              value={suratInput}
              onChange={(e) => setSuratInput(e.target.value)}
            />

            <button
              onClick={generateSurat}
              disabled={!selectedTpl || !suratInput.trim() || isGenerating}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/35 bg-violet-500/12 py-2.5 text-[13px] font-semibold text-violet-200 shadow-[0_0_24px_rgba(139,92,246,0.2)] transition-all hover:bg-violet-500/22 hover:shadow-[0_0_36px_rgba(139,92,246,0.35)] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isGenerating ? (
                <><Spinner color="border-violet-300" /> Generating...</>
              ) : (
                <><Icon icon="solar:magic-stick-3-linear" className="text-base" /> Generate Dokumen</>
              )}
            </button>

            <AnimatePresence>
              {suratResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/8 p-4">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-300">
                        <Icon icon="solar:check-circle-bold" className="text-base" />
                        Dokumen Siap
                      </span>
                      <div className="flex gap-1.5">
                        <PillBtn icon="solar:download-linear" label="Unduh" />
                        <PillBtn icon="solar:share-linear"   label="Kirim" />
                        <PillBtn icon="solar:copy-linear"    label="Salin" />
                      </div>
                    </div>
                    <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap text-[10.5px] leading-relaxed text-slate-300">
                      {suratResult}
                    </pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ════════ Activity Log (full width) ════════ */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="overflow-hidden rounded-3xl border border-white/8 bg-[#060d1a]/80 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/6 px-6 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80">
                <Icon icon="solar:terminal-bold-duotone" className="text-base text-slate-300" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Activity Log</p>
                <p className="text-[10px] text-slate-500">Real-time output sistem AI</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
                Live
              </span>
              <button
                onClick={clearLogs}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>

          <div
            ref={logRef}
            className="h-56 overflow-y-auto px-6 py-4 font-mono text-[11px] leading-relaxed"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#1e293b transparent" }}
          >
            <AnimatePresence initial={false}>
              {logs.map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-baseline gap-2 py-[2px]"
                >
                  <span className="shrink-0 text-slate-700">[{l.ts}]</span>
                  <span className={`shrink-0 ${logStyle[l.type].text}`}>{logStyle[l.type].prefix}</span>
                  <span className="text-slate-300">{l.msg}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function HeroStat({ icon, value, label, color }: { icon: string; value: string; label: string; color: keyof typeof clr }) {
  const c = clr[color];
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2 ${c.border} ${c.bg}`}>
      <Icon icon={icon} className={`text-lg ${c.text}`} />
      <div className="leading-tight">
        <p className={`text-sm font-bold tabular-nums ${c.text}`}>{value}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function Toggle({ on, color, onChange }: { on: boolean; color: string; onChange: () => void }) {
  const c = clr[color as keyof typeof clr];
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative h-5 w-9 rounded-full border transition-all duration-300 ${
        on ? `${c.border} ${c.bg}` : "border-white/12 bg-white/6"
      }`}
    >
      <motion.span
        className={`absolute top-0.5 h-4 w-4 rounded-full transition-colors ${on ? c.dot : "bg-slate-600"}`}
        animate={{ x: on ? "calc(100% - 2px)" : "2px" }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className={`h-4 w-4 rounded-full border-2 border-white/20 ${color} border-t-current`}
    />
  );
}

function IconBtn({ icon, onClick, title }: { icon: string; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
    >
      <Icon icon={icon} className="text-base" />
    </button>
  );
}

function PillBtn({ icon, label }: { icon: string; label: string }) {
  return (
    <button className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 transition hover:bg-white/10 hover:text-white">
      <Icon icon={icon} className="text-[11px]" />
      {label}
    </button>
  );
}
