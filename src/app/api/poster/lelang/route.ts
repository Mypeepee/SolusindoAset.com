import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import type { LelangPosterPayload } from "@/lib/lelangPoster";
import { renderStoryPoster } from "@/lib/server/posterRender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "templates",
  "katalog_lelang_solusindo.html",
);

// Baca ulang tiap unduhan supaya perubahan HTML/CSS langsung dipakai server.
async function getTemplate(): Promise<string> {
  return readFile(TEMPLATE_PATH, "utf8");
}

// Ambil base64 logo brand dari template untuk ditaruh di tengah QR (sekali saja).
let qrLogoCache: string | null = null;
function getQrLogo(tpl: string): string {
  if (qrLogoCache === null) {
    const m = tpl.match(/brand-icon"[^>]*?src="(data:image\/[^"]+)"/);
    qrLogoCache = m ? m[1] : "";
  }
  return qrLogoCache;
}

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Sumber foto boleh dipakai sebagai atribut src (dibungkus tanda kutip).
const escAttr = (s: unknown): string => String(s ?? "").replace(/"/g, "&quot;");

function placeholderThumb(label: string, sub: string): string {
  return (
    `<svg class="thumb-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="4" y="6" width="24" height="20" rx="2" stroke="#0D1B2A" stroke-width="1.5"/>` +
    `<circle cx="11" cy="13" r="3" stroke="#0D1B2A" stroke-width="1.5"/>` +
    `<path d="M4 22 L10 16 L15 21 L20 17 L28 24" stroke="#0D1B2A" stroke-width="1.5" stroke-linejoin="round"/>` +
    `</svg><span class="thumb-label">${esc(label)}</span><span class="thumb-sub">${esc(sub)}</span>`
  );
}

function thumb(src: string | undefined, label: string, sub: string): string {
  if (src) {
    return `<img src="${escAttr(src)}" alt="${esc(label)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />`;
  }
  return placeholderThumb(label, sub);
}

function buildHtml(tpl: string, d: LelangPosterPayload): string {
  const photos = Array.isArray(d.photos) ? d.photos : [];
  // Kalau foto < 3, isi slot yang kosong dengan mengulang foto yang ada
  // (mis. 1 foto → ketiga slot memakai foto yang sama).
  const pick = (i: number): string | undefined =>
    photos.length ? photos[i % photos.length] : undefined;
  const mainSrc = pick(0) || "";

  const hasDiscount =
    Boolean(d.hargaLelangAwal) &&
    typeof d.diskonPct === "number" &&
    Number.isFinite(d.diskonPct) &&
    d.diskonPct > 0 &&
    d.diskonPct < 100;
  const discountBadge = hasDiscount
    ? `<div class="ticket-discount">` +
      `<svg class="ticket-discount-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
      `<path d="M12 2c1.3 4-2.5 6.1-2.5 9.2-1.1-.8-1.8-1.8-1.9-3.2C5.2 10.6 4 12.8 4 15a8 8 0 0 0 16 0c0-4.4-2.8-8.3-5.5-10.4.1 2.1-.6 3.5-1.7 4.6C13.5 6.6 13.1 4 12 2Z" fill="currentColor"/>` +
      `<path d="M12.3 12c.4 2.2-2.8 3.4-2.8 5.5a2.8 2.8 0 0 0 5.6 0c0-1.8-1.2-3.8-2.8-5.5Z" fill="#FFF1C9"/></svg>` +
      `<span class="ticket-discount-label">Hemat</span>` +
      `<span class="ticket-discount-value">${esc(new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(d.diskonPct!))}%</span></div>`
    : "";
  const ticketCompare = hasDiscount
    ? `<div class="ticket-topline"><div class="ticket-compare">` +
      `<span class="ticket-compare-label">Harga pasaran</span>` +
      `<s class="ticket-compare-price">${esc(d.hargaLelangAwal)}</s></div>${discountBadge}</div>`
    : "";
  const ticketSaving = hasDiscount && d.hematNominal
    ? `<div class="ticket-saving">Lebih hemat ${esc(d.hematNominal)}</div>`
    : "";
  const limitParts = String(d.hargaLimit || "").match(/^Rp\s*(.+)$/i);
  const hargaLimit = limitParts
    ? `<span class="ticket-currency">Rp</span> <span class="ticket-price-amount">${esc(limitParts[1])}</span>`
    : esc(d.hargaLimit);
  const extraParts: string[] = [];
  if (d.uangJaminan) {
    extraParts.push(
      `<div class="ticket-jaminan">` +
        `<span class="tj-label">Uang Jaminan</span>` +
        `<span class="tj-value">${esc(d.uangJaminan)}</span>` +
        `<span class="tj-note">Setor sebelum lelang dimulai</span>` +
        `</div>`,
    );
  }
  const ticketExtra = extraParts.join("");

  // ecc=H (error-correction tinggi) supaya QR tetap ter-scan walau ada logo di tengah.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&qzone=1&ecc=H&data=${encodeURIComponent(
    d.qrUrl || "",
  )}`;

  const map: Record<string, string> = {
    "{{PHOTO_MAIN}}": escAttr(mainSrc),
    "{{THUMB_2}}": thumb(pick(1), "Foto 2", "tampak lain"),
    "{{THUMB_3}}": thumb(pick(2), "Foto 3", "tampak lain"),
    "{{HERO_TITLE}}": esc(d.heroTitle),
    "{{EYEBROW}}": esc(d.eyebrow),
    "{{ALAMAT}}": esc(d.alamat),
    "{{LUAS_TANAH}}": esc(d.luasTanah || "Belum tersedia"),
    "{{LUAS_TANAH_TERBILANG}}": d.luasTanahTerbilang
      ? `<div class="land-words">${esc(d.luasTanahTerbilang)}</div>`
      : "",
    "{{LUAS_BANGUNAN}}": d.luasBangunan
      ? `<div class="land-sub">Luas bangunan ${esc(d.luasBangunan)}</div>`
      : "",
    "{{LEGAL_MAIN}}": esc(d.legalMain),
    "{{LEGAL_SUB}}": esc(d.legalSub),
    "{{HARGA_LIMIT}}": hargaLimit,
    "{{TICKET_COMPARE}}": ticketCompare,
    "{{TICKET_SAVING}}": ticketSaving,
    "{{TICKET_EXTRA}}": ticketExtra,
    "{{CONTACT_NUM}}": esc(d.contactNum),
    "{{AGENT_NAME}}": esc(d.agentName),
    "{{QR_SRC}}": escAttr(qrSrc),
    "{{QR_LOGO}}": escAttr(getQrLogo(tpl)),
  };

  return tpl.replace(
    /\{\{(PHOTO_MAIN|THUMB_2|THUMB_3|HERO_TITLE|EYEBROW|ALAMAT|LUAS_TANAH|LUAS_TANAH_TERBILANG|LUAS_BANGUNAN|LEGAL_MAIN|LEGAL_SUB|HARGA_LIMIT|TICKET_COMPARE|TICKET_SAVING|TICKET_EXTRA|CONTACT_NUM|AGENT_NAME|QR_SRC|QR_LOGO)\}\}/g,
    (m) => map[m] ?? "",
  );
}

export async function POST(req: NextRequest) {
  let payload: LelangPosterPayload;
  try {
    payload = (await req.json()) as LelangPosterPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || typeof payload.heroTitle !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const tpl = await getTemplate();
    const html = buildHtml(tpl, payload);
    const buffer = await renderStoryPoster(html, async (page) => {
      await page.evaluate(async () => {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]);
        // Semua angka tetap utuh, termasuk harga awal dan jaminan bernilai besar.
        for (const el of document.querySelectorAll<HTMLElement>(
          ".ticket-price, .ticket-compare-price, .ticket-saving, .tj-value, .land-main",
        )) {
          let size = parseFloat(getComputedStyle(el).fontSize);
          while (el.scrollWidth > el.clientWidth && size > 7) {
            size -= 0.5;
            el.style.fontSize = `${size}px`;
          }
        }
      });
    });

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'attachment; filename="poster-lelang.jpg"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[poster/lelang] gagal render:", err);
    return NextResponse.json({ error: "Gagal membuat poster" }, { status: 500 });
  }
}
