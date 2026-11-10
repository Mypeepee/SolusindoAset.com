import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { JualPosterData } from "@/lib/jualPoster";
import type { LelangPosterPayload } from "@/lib/lelangPoster";
import { renderStoryPoster } from "./posterRender";

const jualTemplatePath = path.join(
  process.cwd(),
  "public",
  "templates",
  "katalog-primary-secondary_Solusindo.html",
);
const lelangTemplatePath = path.join(
  process.cwd(),
  "public",
  "templates",
  "katalog_lelang_solusindo.html",
);

let jualTemplateCache: string | null = null;
async function getJualTemplate() {
  if (!jualTemplateCache)
    jualTemplateCache = await readFile(jualTemplatePath, "utf8");
  return jualTemplateCache;
}

/** Renders the same Primary/Secondary HTML poster as /api/poster/jual. */
export async function renderJualPosterImage(data: JualPosterData) {
  const html = await getJualTemplate();
  return renderStoryPoster(html, async (page) => {
    try {
      await page.waitForFunction("typeof window.qrcode !== 'undefined'", {
        timeout: 8000,
      });
    } catch {
      // QR gagal dimuat; poster tetap dibuat tanpa QR.
    }
    await page.evaluate((payload: JualPosterData) => {
      (window as any).renderKatalog(payload);
    }, data);
  });
}

let qrLogoCache: string | null = null;
function getQrLogo(template: string) {
  if (qrLogoCache === null) {
    const match = template.match(/brand-icon"[^>]*?src="(data:image\/[^\"]+)"/);
    qrLogoCache = match ? match[1] : "";
  }
  return qrLogoCache;
}

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escAttr = (value: unknown) => String(value ?? "").replace(/"/g, "&quot;");

function placeholderThumb(label: string, sub: string) {
  return (
    `<svg class="thumb-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="4" y="6" width="24" height="20" rx="2" stroke="#0D1B2A" stroke-width="1.5"/>` +
    `<circle cx="11" cy="13" r="3" stroke="#0D1B2A" stroke-width="1.5"/>` +
    `<path d="M4 22 L10 16 L15 21 L20 17 L28 24" stroke="#0D1B2A" stroke-width="1.5" stroke-linejoin="round"/>` +
    `</svg><span class="thumb-label">${esc(label)}</span><span class="thumb-sub">${esc(sub)}</span>`
  );
}

function thumb(src: string | undefined, label: string, sub: string) {
  if (src) {
    return `<img src="${escAttr(src)}" alt="${esc(label)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />`;
  }
  return placeholderThumb(label, sub);
}

function buildLelangHtml(template: string, data: LelangPosterPayload) {
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const pick = (index: number) =>
    photos.length ? photos[index % photos.length] : undefined;
  const hasDiscount =
    Boolean(data.hargaLelangAwal) &&
    typeof data.diskonPct === "number" &&
    Number.isFinite(data.diskonPct) &&
    data.diskonPct > 0 &&
    data.diskonPct < 100;
  const discountBadge = hasDiscount
    ? `<div class="ticket-discount">` +
      `<svg class="ticket-discount-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">` +
      `<path d="M12 2c1.3 4-2.5 6.1-2.5 9.2-1.1-.8-1.8-1.8-1.9-3.2C5.2 10.6 4 12.8 4 15a8 8 0 0 0 16 0c0-4.4-2.8-8.3-5.5-10.4.1 2.1-.6 3.5-1.7 4.6C13.5 6.6 13.1 4 12 2Z" fill="currentColor"/>` +
      `<path d="M12.3 12c.4 2.2-2.8 3.4-2.8 5.5a2.8 2.8 0 0 0 5.6 0c0-1.8-1.2-3.8-2.8-5.5Z" fill="#FFF1C9"/></svg>` +
      `<span class="ticket-discount-label">Hemat</span>` +
      `<span class="ticket-discount-value">${esc(new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(data.diskonPct!))}%</span></div>`
    : "";
  const ticketCompare = hasDiscount
    ? `<div class="ticket-topline"><div class="ticket-compare">` +
      `<span class="ticket-compare-label">Harga pasaran</span>` +
      `<s class="ticket-compare-price">${esc(data.hargaLelangAwal)}</s></div>${discountBadge}</div>`
    : "";
  const ticketSaving = hasDiscount && data.hematNominal
    ? `<div class="ticket-saving">Lebih hemat ${esc(data.hematNominal)}</div>`
    : "";
  const limitParts = String(data.hargaLimit || "").match(/^Rp\s*(.+)$/i);
  const hargaLimit = limitParts
    ? `<span class="ticket-currency">Rp</span> <span class="ticket-price-amount">${esc(limitParts[1])}</span>`
    : esc(data.hargaLimit);
  const ticketExtra = data.uangJaminan
    ? `<div class="ticket-jaminan"><span class="tj-label">Uang Jaminan</span><span class="tj-value">${esc(data.uangJaminan)}</span><span class="tj-note">Setor sebelum lelang dimulai</span></div>`
    : "";
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&qzone=1&ecc=H&data=${encodeURIComponent(data.qrUrl || "")}`;
  const map: Record<string, string> = {
    "{{PHOTO_MAIN}}": escAttr(pick(0) || ""),
    "{{THUMB_2}}": thumb(pick(1), "Foto 2", "tampak lain"),
    "{{THUMB_3}}": thumb(pick(2), "Foto 3", "tampak lain"),
    "{{HERO_TITLE}}": esc(data.heroTitle),
    "{{EYEBROW}}": esc(data.eyebrow),
    "{{ALAMAT}}": esc(data.alamat),
    "{{LUAS_TANAH}}": esc(data.luasTanah || "Belum tersedia"),
    "{{LUAS_TANAH_TERBILANG}}": data.luasTanahTerbilang
      ? `<div class="land-words">${esc(data.luasTanahTerbilang)}</div>`
      : "",
    "{{LUAS_BANGUNAN}}": data.luasBangunan
      ? `<div class="land-sub">Luas bangunan ${esc(data.luasBangunan)}</div>`
      : "",
    "{{LEGAL_MAIN}}": esc(data.legalMain),
    "{{LEGAL_SUB}}": esc(data.legalSub),
    "{{HARGA_LIMIT}}": hargaLimit,
    "{{TICKET_COMPARE}}": ticketCompare,
    "{{TICKET_SAVING}}": ticketSaving,
    "{{TICKET_EXTRA}}": ticketExtra,
    "{{CONTACT_NUM}}": esc(data.contactNum),
    "{{AGENT_NAME}}": esc(data.agentName),
    "{{QR_SRC}}": escAttr(qrSrc),
    "{{QR_LOGO}}": escAttr(getQrLogo(template)),
  };
  return template.replace(
    /\{\{(PHOTO_MAIN|THUMB_2|THUMB_3|HERO_TITLE|EYEBROW|ALAMAT|LUAS_TANAH|LUAS_TANAH_TERBILANG|LUAS_BANGUNAN|LEGAL_MAIN|LEGAL_SUB|HARGA_LIMIT|TICKET_COMPARE|TICKET_SAVING|TICKET_EXTRA|CONTACT_NUM|AGENT_NAME|QR_SRC|QR_LOGO)\}\}/g,
    (match) => map[match] ?? "",
  );
}

/** Renders the same LeLang HTML poster as /api/poster/lelang. */
export async function renderLelangPosterImage(data: LelangPosterPayload) {
  const template = await readFile(lelangTemplatePath, "utf8");
  const html = buildLelangHtml(template, data);
  return renderStoryPoster(html, async (page) => {
    await page.evaluate(async () => {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      for (const element of document.querySelectorAll<HTMLElement>(
        ".ticket-price, .ticket-compare-price, .ticket-saving, .tj-value, .land-main",
      )) {
        let size = parseFloat(getComputedStyle(element).fontSize);
        while (element.scrollWidth > element.clientWidth && size > 7) {
          size -= 0.5;
          element.style.fontSize = `${size}px`;
        }
      }
    });
  });
}
