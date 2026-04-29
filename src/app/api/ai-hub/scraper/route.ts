// src/app/api/ai-hub/scraper/route.ts
// Multi-kategori paralel — setiap kategori punya proses & state sendiri.
// GET ?stream=1            → SSE gabungan semua kategori (+ replay buffer)
// GET ?stream=1&k=Tanah    → SSE khusus satu kategori
// GET                      → status JSON semua kategori
// POST { all:true }        → mulai semua kategori sekaligus
// POST { kategori:"Tanah"} → mulai satu kategori
// DELETE { all:true }      → hentikan semua
// DELETE { kategori:"..." }→ hentikan satu

import { NextRequest } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enc = new TextEncoder();

const KATEGORI_LIST = [
  "Rumah", "Apartemen", "Ruko", "Tanah",
  "Gudang", "Hotel dan Villa", "Toko", "Pabrik",
];

const sseHeaders = {
  "Content-Type":  "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection":    "keep-alive",
};

// ── Per-kategori state ────────────────────────────────────────────────────────

interface Instance {
  proc:      ChildProcess | null;
  running:   boolean;
  saved:     number;
  skip:      number;
  errors:    number;
  page:      number;
  startedAt: string | null;
  logBuffer: object[];
  clients:   Set<ReadableStreamDefaultController<Uint8Array>>;
}

// instances persists across requests di server yang sama
const instances = new Map<string, Instance>();

// Global clients — menerima events dari SEMUA kategori
const globalClients = new Set<ReadableStreamDefaultController<Uint8Array>>();

function getInstance(k: string): Instance {
  if (!instances.has(k)) {
    instances.set(k, {
      proc: null, running: false, saved: 0, skip: 0,
      errors: 0, page: 0, startedAt: null, logBuffer: [], clients: new Set(),
    });
  }
  return instances.get(k)!;
}

function chunk(data: object): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Broadcast event ke kategori tertentu + ke global clients. */
function broadcast(kategori: string, data: object) {
  const inst = getInstance(kategori);
  const d    = data as Record<string, unknown>;
  if (typeof d.saved  === "number") inst.saved  = d.saved;
  if (typeof d.skip   === "number") inst.skip   = d.skip;
  if (typeof d.errors === "number") inst.errors = d.errors;
  if (typeof d.page   === "number") inst.page   = d.page;

  const tagged = { ...d, kategori };
  inst.logBuffer.push(tagged);
  if (inst.logBuffer.length > 300) inst.logBuffer.splice(0, inst.logBuffer.length - 300);

  for (const ctrl of inst.clients) {
    try { ctrl.enqueue(chunk(tagged)); } catch { inst.clients.delete(ctrl); }
  }
  for (const ctrl of globalClients) {
    try { ctrl.enqueue(chunk(tagged)); } catch { globalClients.delete(ctrl); }
  }
}

/** Buat SSE stream untuk satu kategori. */
function makeCatStream(kategori: string, replay: boolean): ReadableStream<Uint8Array> {
  const inst = getInstance(kategori);
  let myCtrl: ReadableStreamDefaultController<Uint8Array>;
  return new ReadableStream({
    start(c) {
      myCtrl = c;
      if (replay) for (const e of inst.logBuffer) { try { c.enqueue(chunk(e)); } catch {} }
      inst.clients.add(c);
    },
    cancel() { inst.clients.delete(myCtrl); },
  });
}

/** Buat SSE stream gabungan semua kategori. */
function makeGlobalStream(replay: boolean): ReadableStream<Uint8Array> {
  let myCtrl: ReadableStreamDefaultController<Uint8Array>;
  return new ReadableStream({
    start(c) {
      myCtrl = c;
      if (replay) {
        // Gabung & sort semua buffer berdasarkan timestamp
        const all: any[] = [];
        for (const inst of instances.values()) all.push(...inst.logBuffer);
        all.sort((a, b) => String(a.ts ?? "").localeCompare(String(b.ts ?? "")));
        for (const e of all) { try { c.enqueue(chunk(e)); } catch {} }
      }
      globalClients.add(c);
    },
    cancel() { globalClients.delete(myCtrl); },
  });
}

// ── Core: spawn satu scraper process ─────────────────────────────────────────

function spawnScraper(
  kategori: string,
  agentId: string,
  maxPages: number,
  startPage: number,
  dbUrl: string,
  pythonBin: string,
  scriptPath: string,
) {
  const inst = getInstance(kategori);
  if (inst.running) return;           // sudah jalan, skip

  inst.running   = true;
  inst.saved     = 0;
  inst.skip      = 0;
  inst.errors    = 0;
  inst.page      = 0;
  inst.startedAt = new Date().toISOString();
  inst.logBuffer = [];

  const args = [scriptPath, "--kategori", kategori, "--db-url", dbUrl, "--start-page", String(startPage)];
  if (agentId)  args.push("--agent",     agentId);
  if (maxPages) args.push("--max-pages", String(maxPages));

  const proc = spawn(pythonBin, args, { env: { ...process.env, PYTHONUNBUFFERED: "1" } });
  inst.proc = proc;

  broadcast(kategori, { level: "info", msg: `Memulai scraper — kategori: ${kategori}` });

  let buf = "";
  proc.stdout.on("data", (data: Buffer) => {
    buf += data.toString();
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try { broadcast(kategori, JSON.parse(t)); }
      catch { broadcast(kategori, { level: "info", msg: t }); }
    }
  });

  proc.stderr.on("data", (data: Buffer) => {
    const t = data.toString().trim();
    if (t) broadcast(kategori, { level: "warn", msg: t });
  });

  proc.on("close", (code) => {
    inst.running = false;
    inst.proc    = null;
    broadcast(kategori, {
      level:  code === 0 ? "success" : "error",
      msg:    code === 0
        ? `Scraper ${kategori} selesai — disimpan: ${inst.saved}`
        : `Scraper ${kategori} berhenti (exit ${code}).`,
      done:   true,
      saved:  inst.saved,
      skip:   inst.skip,
      errors: inst.errors,
    });
    for (const c of inst.clients) { try { c.close(); } catch {} }
    inst.clients.clear();

    // Kalau semua scraper sudah selesai → tutup global stream
    const stillRunning = [...instances.values()].some(i => i.running);
    if (!stillRunning) {
      const totalSaved = [...instances.values()].reduce((s, i) => s + i.saved, 0);
      const ev = { level: "success", msg: `✓ Semua scraper selesai — total: ${totalSaved}`, all_done: true };
      for (const c of globalClients) { try { c.enqueue(chunk(ev)); c.close(); } catch {} }
      globalClients.clear();
    }
  });

  proc.on("error", (e) => {
    inst.running = false;
    inst.proc    = null;
    broadcast(kategori, { level: "error", msg: `Gagal: ${e.message}`, done: true });
    for (const c of inst.clients) { try { c.close(); } catch {} }
    inst.clients.clear();
  });
}

// ── POST: mulai satu atau semua kategori ──────────────────────────────────────

export async function POST(req: NextRequest) {
  const body      = await req.json().catch(() => ({}));
  const agentId   = (body.agentId   as string) || "";
  const maxPages  = (body.maxPages  as number) || 0;
  const startPage = (body.startPage as number) || 1;

  const scriptPath = path.resolve(process.cwd(), "scripts/scraper_lelang.py");
  const venvPython = path.resolve(process.cwd(), "scripts/.venv/bin/python3");
  const pythonBin  = fs.existsSync(venvPython) ? venvPython : "python3";
  const dbUrl      = process.env.DATABASE_URL || "";

  // Tentukan daftar kategori yang akan dijalankan
  let targets: string[];
  if (body.all) {
    targets = KATEGORI_LIST;
  } else if (Array.isArray(body.kategori)) {
    targets = body.kategori as string[];
  } else {
    targets = [(body.kategori as string) || "Rumah"];
  }

  const alreadyRunning = targets.filter(k => getInstance(k).running);
  if (alreadyRunning.length === targets.length) {
    return Response.json(
      { error: `Semua kategori sudah berjalan: ${alreadyRunning.join(", ")}` },
      { status: 409 },
    );
  }

  // Jalankan semua yang belum running
  const toStart = targets.filter(k => !getInstance(k).running);
  for (const k of toStart) {
    spawnScraper(k, agentId, maxPages, startPage, dbUrl, pythonBin, scriptPath);
  }

  // Kembalikan SSE gabungan
  return new Response(makeGlobalStream(false), { headers: sseHeaders });
}

// ── GET: status JSON atau reconnect SSE ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const streamParam   = req.nextUrl.searchParams.get("stream");
  const kategoriParam = req.nextUrl.searchParams.get("k");

  if (streamParam === "1") {
    const anyRunning = [...instances.values()].some(i => i.running);
    if (!anyRunning) return Response.json({ error: "Tidak ada scraper yang berjalan." }, { status: 404 });

    if (kategoriParam) return new Response(makeCatStream(kategoriParam, true), { headers: sseHeaders });
    return new Response(makeGlobalStream(true), { headers: sseHeaders });
  }

  // Status JSON semua kategori
  const categories: Record<string, object> = {};
  for (const k of KATEGORI_LIST) {
    const inst = getInstance(k);
    categories[k] = {
      running:   inst.running,
      saved:     inst.saved,
      skip:      inst.skip,
      errors:    inst.errors,
      page:      inst.page,
      startedAt: inst.startedAt,
    };
  }
  return Response.json({
    anyRunning: [...instances.values()].some(i => i.running),
    categories,
  });
}

// ── DELETE: hentikan satu atau semua ─────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const toStop = body.all
    ? KATEGORI_LIST
    : [(body.kategori as string) || ""].filter(Boolean);

  const stopped: string[] = [];
  for (const k of toStop) {
    const inst = getInstance(k);
    if (inst.proc && !inst.proc.killed) {
      inst.proc.kill("SIGTERM");
      inst.running = false;
      inst.proc    = null;
      broadcast(k, { level: "warn", msg: `Scraper ${k} dihentikan.`, done: true });
      for (const c of inst.clients) { try { c.close(); } catch {} }
      inst.clients.clear();
      stopped.push(k);
    }
  }

  if (body.all) {
    for (const c of globalClients) { try { c.close(); } catch {} }
    globalClients.clear();
  }

  return Response.json({ ok: true, stopped });
}
