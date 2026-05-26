"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";

const KATEGORI = [
  { value: "Rumah", label: "Rumah", icon: "solar:home-2-bold-duotone", color: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-300" },
  { value: "Tanah", label: "Tanah", icon: "solar:map-bold-duotone", color: "from-lime-500/20 to-lime-600/5 border-lime-500/30 text-lime-300" },
  { value: "Apartemen", label: "Apartemen", icon: "solar:buildings-2-bold-duotone", color: "from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-300" },
  { value: "Ruko", label: "Ruko", icon: "solar:shop-bold-duotone", color: "from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-300" },
  { value: "Gudang", label: "Gudang", icon: "solar:box-minimalistic-bold-duotone", color: "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-300" },
  { value: "Hotel dan Villa", label: "Villa & Hotel", icon: "solar:home-smile-bold-duotone", color: "from-pink-500/20 to-pink-600/5 border-pink-500/30 text-pink-300" },
  { value: "Toko", label: "Toko", icon: "solar:bag-4-bold-duotone", color: "from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-300" },
  { value: "Pabrik", label: "Pabrik", icon: "solar:factory-bold-duotone", color: "from-slate-500/20 to-slate-600/5 border-slate-500/30 text-slate-300" },
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
  const [startPage, setStartPage] = useState(1);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalSkipped, setTotalSkipped] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Stream consumer — shared antara handleStart (start baru) dan auto-reconnect.
  // body: kategori + startPage. Server akan ABAIKAN body kalau job sudah jalan
  // (just attach as subscriber), atau pakai body untuk start baru.
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

        console.log("[scrape-client] consumeStream: fetch OK, starting read loop");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("[scrape-client] stream done (read returned done). events:", eventCount);
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const event: LogLine = JSON.parse(line.slice(5).trim());
              eventCount++;
              if (eventCount <= 5 || eventCount % 20 === 0) {
                console.log(`[scrape-client] event #${eventCount}:`, event.type, (event.msg ?? "").substring(0, 80));
              }
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

        // Stream closed oleh server (setelah terminal event) — pastikan status final.
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
    // Eksplisit panggil endpoint /stop. Stream akan close otomatis lewat event
    // "cancelled" dari server. Tidak abort lokal — itu cuma putus connection,
    // sedangkan kita mau benar-benar hentikan worker di server.
    try {
      await fetch("/api/scrape/lelang/stop", { method: "POST" });
    } catch {}
  };

  // Auto-reconnect: kalau ada job aktif di server saat mount (user balik ke
  // page setelah navigate away), langsung sambung ke stream-nya.
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        console.log("[scrape-client] mount: checking /status");
        const r = await fetch("/api/scrape/lelang/status", {
          cache: "no-store",
        });
        console.log("[scrape-client] /status response status:", r.status);
        if (aborted) {
          console.log("[scrape-client] aborted before processing response");
          return;
        }
        if (!r.ok) {
          console.warn("[scrape-client] /status not ok:", r.status, await r.text().catch(() => ""));
          return;
        }
        const data = await r.json();
        console.log("[scrape-client] /status data:", data);
        if (data.running && data.job) {
          console.log("[scrape-client] reconnecting to job", data.job.id);
          setKategori(data.job.kategori);
          setStartPage(data.job.startPage);
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
        } else {
          console.log("[scrape-client] no running job on server");
        }
      } catch (e) {
        console.error("[scrape-client] mount error:", e);
      }
    })();

    return () => {
      aborted = true;
      // Cleanup koneksi (release reader). Server-side TIDAK cancel job karena
      // stream.cancel() di server cuma unsubscribe — job tetap jalan.
      abortRef.current?.abort();
    };
  }, [consumeStream]);

  const isRunning = status === "running";

  return (
    <div className="min-h-screen bg-[#040608] p-4 md:p-6 space-y-5">

      {/* ── DEBUG bar (hapus setelah issue selesai) ── */}
      <div className="font-mono text-[10px] text-slate-500 border border-yellow-500/30 bg-yellow-500/5 rounded-lg px-3 py-1.5">
        DEBUG → status: <span className="text-yellow-300">{status}</span> ·
        logs: <span className="text-yellow-300">{logs.length}</span> ·
        saved: <span className="text-yellow-300">{totalSaved}</span> ·
        page: <span className="text-yellow-300">{currentPage}</span> ·
        kategori: <span className="text-yellow-300">{kategori}</span>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/30 to-violet-700/10 border border-violet-500/30 flex items-center justify-center shrink-0">
          <Icon icon="solar:spider-bold-duotone" className="text-violet-300 text-2xl" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white leading-none">Scrape Lelang</h1>
          <p className="text-xs text-slate-400 mt-1">Ambil data dari <span className="text-violet-400">lelang.go.id</span> langsung ke database listing</p>
        </div>

        {/* Stats pills */}
        {(totalSaved > 0 || totalSkipped > 0) && (
          <div className="ml-auto flex items-center gap-2">
            {totalSaved > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-sm" />
                <span className="text-xs font-bold text-emerald-300">{totalSaved} tersimpan</span>
              </div>
            )}
            {totalSkipped > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700/50 border border-slate-600/30">
                <Icon icon="solar:skip-next-bold" className="text-slate-400 text-sm" />
                <span className="text-xs text-slate-400">{totalSkipped} skip</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Config Card ── */}
      <div className="rounded-2xl border border-white/8 bg-[#07090f] p-5">

        {/* Pilih Kategori */}
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Kategori Properti
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {KATEGORI.map((k) => {
            const active = kategori === k.value;
            return (
              <button
                key={k.value}
                onClick={() => !isRunning && setKategori(k.value)}
                disabled={isRunning}
                className={`relative flex flex-col items-center gap-2 py-4 rounded-xl border bg-gradient-to-b transition-all duration-200
                  ${active ? k.color : "from-white/0 to-white/0 border-white/8 text-slate-500"}
                  ${isRunning ? "cursor-not-allowed opacity-60" : "hover:border-white/20 hover:text-slate-300 cursor-pointer"}`}
              >
                <Icon icon={k.icon} className="text-2xl" />
                <span className="text-xs font-semibold">{k.label}</span>
                {active && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                )}
              </button>
            );
          })}
        </div>

        {/* Start Page + Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <Icon icon="solar:alt-arrow-right-linear" className="text-slate-400 text-sm" />
            <span className="text-xs text-slate-400 shrink-0">Mulai halaman</span>
            <input
              type="number"
              min={1}
              value={startPage}
              onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isRunning}
              className="w-12 bg-transparent text-center text-white text-sm font-bold focus:outline-none"
            />
          </div>

          {!isRunning ? (
            <button
              onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-[0.98] text-white text-sm font-bold transition-all duration-150"
            >
              <Icon icon="solar:play-bold" className="text-base" />
              Mulai Scraping
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-500 active:scale-[0.98] text-white text-sm font-bold transition-all duration-150"
            >
              <Icon icon="solar:stop-bold" className="text-base" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Running indicator ── */}
      {isRunning && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
          <span className="text-sm text-violet-300 font-medium">
            Sedang scraping halaman {currentPage} &mdash; kategori <strong>{kategori}</strong>
          </span>
          <Icon icon="solar:settings-bold" className="ml-auto text-violet-400 animate-spin text-base" />
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <Icon icon="solar:check-circle-bold" className="text-emerald-400 text-xl shrink-0" />
          <span className="text-sm text-emerald-300 font-medium">
            Selesai! <strong>{totalSaved}</strong> listing tersimpan, <strong>{totalSkipped}</strong> sudah ada sebelumnya.
          </span>
        </div>
      )}

      {/* ── Main content: log + hasil ── */}
      {logs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Log terminal */}
          <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-[#050709] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <span className="text-xs text-slate-500 font-mono ml-1">scrape.log</span>
            </div>
            <div className="h-80 overflow-y-auto p-3 font-mono text-[11px] space-y-0.5">
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={`leading-relaxed ${
                    l.type === "error" ? "text-red-400" :
                    l.type === "saved" ? "text-emerald-400" :
                    l.type === "done"  ? "text-violet-300 font-bold" :
                    "text-slate-400"
                  }`}
                >
                  {l.msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Hasil tersimpan */}
          <div className="lg:col-span-3 rounded-2xl border border-white/8 bg-[#07090f] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Baru Tersimpan</span>
              <span className="text-xs text-emerald-400 font-bold">{totalSaved} listing</span>
            </div>
            <div className="h-80 overflow-y-auto divide-y divide-white/5">
              {saved.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
                  <Icon icon="solar:ghost-bold-duotone" className="text-4xl" />
                  <span className="text-xs">Belum ada yang tersimpan</span>
                </div>
              ) : (
                saved.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.gambar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.gambar} alt="" className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <Icon icon="solar:home-2-bold-duotone" className="text-slate-600 text-xl" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{item.alamat_lengkap || item.judul}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Icon icon="solar:map-point-linear" className="text-slate-500" />
                          {item.kota}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400">{formatRp(item.harga)}</span>
                      </div>
                    </div>
                    <Icon icon="solar:check-circle-bold" className="text-emerald-500 text-base shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {logs.length === 0 && status === "idle" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-20 h-20 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Icon icon="solar:spider-bold-duotone" className="text-4xl text-violet-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Siap Scraping</p>
            <p className="text-slate-400 text-sm mt-1">
              Pilih kategori lalu tekan <strong className="text-violet-400">Mulai Scraping</strong>
            </p>
            <p className="text-slate-500 text-xs mt-1">Data akan langsung tersimpan ke database listing</p>
          </div>
        </div>
      )}
    </div>
  );
}
