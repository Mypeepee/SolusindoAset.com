import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { existsSync } from "fs";
import ffmpegStatic from "ffmpeg-static";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

// Webpack memangkas path bawaan ffmpeg-static (jadi .next/.../ffmpeg yang tidak ada),
// jadi resolve manual dari node_modules sebagai fallback.
function resolveFfmpegPath(): string | null {
  if (ffmpegStatic && existsSync(ffmpegStatic)) return ffmpegStatic;
  const binName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const candidate = path.join(process.cwd(), "node_modules", "ffmpeg-static", binName);
  if (existsSync(candidate)) return candidate;
  return null;
}

const WIDTH = 1080;
const HEIGHT = 1920;
const DURATION = 12; // detik
const MAX_SLIDES = 6;
const TRANSITION = 0.6; // detik crossfade

const formatMoney = (value: number): string => {
  if (!value || isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
};

const toNumber = (v: any): number => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
};

const esc = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") || "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function buildSlideHtml(opts: {
  photo: string;
  logo: string;
  isHot: boolean;
  price: string;
  lt: string;
  lb: string;
  kt: string;
  km: string;
  address: string;
  idProperty: string;
}): string {
  const { photo, logo, isHot, price, lt, lb, kt, km, address, idProperty } = opts;
  const badge = isHot ? "SUPER HOT DEAL" : "PROPERTI LELANG";
  const badgeBg = isHot
    ? "linear-gradient(90deg,#ff2d75,#ff5e3a)"
    : "linear-gradient(90deg,#0ea5e9,#2563eb)";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#0F0F0F;
    font-family:Arial,Helvetica,sans-serif;}
  .stage{position:relative;width:${WIDTH}px;height:${HEIGHT}px;}
  .photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
  .shade{position:absolute;inset:0;background:
    linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 28%,rgba(0,0,0,0) 45%,rgba(0,0,0,.85) 100%);}
  .top{position:absolute;top:60px;left:0;right:0;display:flex;flex-direction:column;
    align-items:center;gap:34px;}
  .logo{height:170px;object-fit:contain;filter:drop-shadow(0 6px 16px rgba(0,0,0,.75));}
  .badge{display:inline-block;padding:20px 46px;border-radius:60px;color:#fff;
    font-size:46px;font-weight:800;letter-spacing:1px;background:${badgeBg};
    box-shadow:0 10px 34px rgba(255,45,117,.45);text-transform:uppercase;}
  .bottom{position:absolute;left:60px;right:60px;bottom:120px;display:flex;
    flex-direction:column;align-items:center;gap:34px;text-align:center;}
  .price{font-size:108px;font-weight:900;color:#fff;letter-spacing:1px;
    text-shadow:0 0 18px rgba(56,189,248,.95),0 0 44px rgba(56,189,248,.75),0 4px 8px rgba(0,0,0,.7);}
  .specs{display:flex;width:100%;justify-content:space-between;gap:14px;
    background:rgba(15,23,42,.72);border:2px solid rgba(56,189,248,.55);border-radius:28px;
    padding:30px 24px;backdrop-filter:blur(2px);}
  .spec{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;
    border-right:1px solid rgba(255,255,255,.18);}
  .spec:last-child{border-right:none;}
  .spec .k{font-size:30px;color:#7dd3fc;font-weight:700;letter-spacing:1px;}
  .spec .v{font-size:42px;color:#fff;font-weight:800;}
  .addr{font-size:38px;color:#f1f5f9;font-weight:600;line-height:1.25;
    text-transform:uppercase;text-shadow:0 2px 6px rgba(0,0,0,.8);max-width:920px;}
  .id{font-size:30px;color:#38bdf8;font-weight:700;letter-spacing:2px;}
  </style></head><body>
  <div class="stage">
    <img class="photo" src="${photo}"/>
    <div class="shade"></div>
    <div class="top">
      ${logo ? `<img class="logo" src="${logo}"/>` : ""}
      <div class="badge">${esc(badge)}</div>
    </div>
    <div class="bottom">
      <div class="price">${esc(price)}</div>
      <div class="specs">
        <div class="spec"><div class="k">LT</div><div class="v">${esc(lt)}</div></div>
        <div class="spec"><div class="k">LB</div><div class="v">${esc(lb)}</div></div>
        <div class="spec"><div class="k">KT</div><div class="v">${esc(kt)}</div></div>
        <div class="spec"><div class="k">KM</div><div class="v">${esc(km)}</div></div>
      </div>
      ${address ? `<div class="addr">${esc(address)}</div>` : ""}
      <div class="id">ID: ${esc(idProperty)}</div>
    </div>
  </div></body></html>`;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath();
    if (!ffmpegPath) return reject(new Error("ffmpeg binary tidak ditemukan"));
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg keluar dengan kode ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

// Bangun filtergraph slideshow dengan crossfade untuk N gambar.
function buildFfmpegArgs(frames: string[], outPath: string): string[] {
  const n = frames.length;
  const inputs: string[] = [];

  if (n === 1) {
    inputs.push("-loop", "1", "-t", String(DURATION), "-i", frames[0]);
    return [
      "-y",
      ...inputs,
      "-vf",
      `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1,format=yuv420p`,
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ];
  }

  const seg = (DURATION + (n - 1) * TRANSITION) / n;
  for (const f of frames) {
    inputs.push("-loop", "1", "-t", String(seg.toFixed(3)), "-i", f);
  }

  const filters: string[] = [];
  for (let i = 0; i < n; i++) {
    filters.push(
      `[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1,format=yuv420p[v${i}]`
    );
  }
  let prev = "v0";
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "vout" : `x${i}`;
    const offset = (i * (seg - TRANSITION)).toFixed(3);
    filters.push(`[${prev}][v${i}]xfade=transition=fade:duration=${TRANSITION}:offset=${offset}[${out}]`);
    prev = out;
  }

  return [
    "-y",
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map", "[vout]",
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outPath,
  ];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const idRaw = params.id;
  let idBig: bigint;
  try {
    idBig = BigInt(idRaw);
  } catch {
    return NextResponse.json({ error: "ID properti tidak valid" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id_property: idBig },
    select: {
      id_property: true,
      slug: true,
      gambar: true,
      harga: true,
      nilai_limit_lelang: true,
      alamat_lengkap: true,
      luas_tanah: true,
      luas_bangunan: true,
      kamar_tidur: true,
      kamar_mandi: true,
      is_hot_deal: true,
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "Properti tidak ditemukan" }, { status: 404 });
  }

  const fotoUrls = (listing.gambar || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SLIDES);

  if (fotoUrls.length === 0) {
    return NextResponse.json({ error: "Properti belum memiliki foto" }, { status: 400 });
  }

  // Logo brand → data URL
  let logoData = "";
  try {
    const logoBuf = await fs.readFile(
      path.join(process.cwd(), "public", "images", "logo", "LogoSolusindoPremier.png")
    );
    logoData = `data:image/png;base64,${logoBuf.toString("base64")}`;
  } catch {
    logoData = "";
  }

  const photos = (await Promise.all(fotoUrls.map(fetchImageDataUrl))).filter(
    (p): p is string => !!p
  );
  if (photos.length === 0) {
    return NextResponse.json({ error: "Gagal memuat foto properti" }, { status: 502 });
  }

  const price = formatMoney(
    toNumber(listing.nilai_limit_lelang) || toNumber(listing.harga)
  );
  const lt = listing.luas_tanah ? `${toNumber(listing.luas_tanah)}m²` : "-";
  const lb = listing.luas_bangunan ? `${toNumber(listing.luas_bangunan)}m²` : "-";
  const kt = listing.kamar_tidur != null ? String(listing.kamar_tidur) : "-";
  const km = listing.kamar_mandi != null ? String(listing.kamar_mandi) : "-";
  const address = listing.alamat_lengkap || "";
  const idProperty = listing.id_property.toString();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propvid-"));

  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const framePaths: string[] = [];
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60000);
      await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

      for (let i = 0; i < photos.length; i++) {
        const html = buildSlideHtml({
          photo: photos[i],
          logo: logoData,
          isHot: !!listing.is_hot_deal,
          price,
          lt,
          lb,
          kt,
          km,
          address,
          idProperty,
        });
        await page.setContent(html, { waitUntil: "load" });
        // Pastikan semua gambar (foto + logo) selesai decode sebelum screenshot.
        await page.evaluate(async () => {
          const imgs = Array.from(document.images);
          await Promise.all(
            imgs.map((img) =>
              img.complete && img.naturalWidth > 0
                ? img.decode().catch(() => undefined)
                : new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                  })
            )
          );
        });
        const framePath = path.join(tmpDir, `frame_${String(i).padStart(3, "0")}.png`);
        await page.screenshot({ path: framePath as `${string}.png`, type: "png" });
        framePaths.push(framePath);
      }
    } finally {
      await browser.close();
    }

    const outPath = path.join(tmpDir, "video.mp4");
    await runFfmpeg(buildFfmpegArgs(framePaths, outPath));

    const mp4 = await fs.readFile(outPath);
    const fileName = `properti-${listing.slug || idProperty}.mp4`;

    return new NextResponse(mp4 as any, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(mp4.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[download-videos] error:", err);
    return NextResponse.json(
      { error: "Gagal membuat video", detail: err?.message || String(err) },
      { status: 500 }
    );
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
