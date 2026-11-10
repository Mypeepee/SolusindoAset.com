import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";
import { resolveFetchableImage } from "@/lib/fotoListing";
import { buildJualPosterData } from "@/lib/jualPoster";
import { buildLelangPosterPayload } from "@/lib/lelangPoster";
import { renderStoryPoster } from "@/lib/server/posterRender";
import {
  renderJualPosterImage,
  renderLelangPosterImage,
} from "@/lib/server/posterTemplates";
import type { AuctionHistoryResult } from "@/lib/auctionHistory";
import { SITE_URL } from "@/lib/site";
import {
  type AssetSnapshot,
  type MarketingConfig,
  normalizePhone,
  marketingListingUrl,
} from "./domain";
import { MarketingError, mediaUrl, publicOrigin } from "./security.server";
import { propertyCoverHtml } from "./property-cover";
export type MarketingMedia = {
  name: string;
  channel: "instagram" | "whatsapp";
  width: number;
  height: number;
};
const mediaDirectory = () => path.join(process.cwd(), "uploads", "marketing");
export const validMediaPath = (job: string, name: string) =>
  /^[a-f0-9-]{36}$/.test(job) && /^(feed|story|photo-[1-3])\.jpg$/.test(name);
export async function readMarketingMedia(job: string, name: string) {
  if (!validMediaPath(job, name)) throw new MarketingError("NOT_FOUND", 404);
  return readFile(path.join(mediaDirectory(), job, name));
}
export function isPublicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224 ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
    );
  }
  // Require globally routed IPv6. IPv4-mapped, loopback, link-local and ULA fail closed.
  return (
    isIP(ip) === 6 &&
    /^[23]/i.test(ip) &&
    !ip.toLowerCase().startsWith("2001:db8")
  );
}
export async function fetchMarketingPhoto(
  reference: string,
): Promise<Buffer | null> {
  const source = resolveFetchableImage(reference, 1600);
  if (!source) return null;
  try {
    let url = new URL(source);
    for (let hop = 0; hop < 4; hop++) {
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return null;
      const hosts = await lookup(url.hostname.replace(/^\[|\]$/g, ""), {
        all: true,
      });
      if (!hosts.length || hosts.some((item) => !isPublicAddress(item.address)))
        return null;
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0", Referer: url.origin + "/" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) return null;
        url = new URL(location, url);
        continue;
      }
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/")
      ) {
        await response.body?.cancel();
        return null;
      }
      const reader = response.body?.getReader();
      if (!reader) return null;
      let size = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 12 * 1024 * 1024) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      const image = Buffer.concat(chunks);
      await sharp(image, { limitInputPixels: 50000000 }).metadata();
      return image;
    }
  } catch {}
  return null;
}
export function posterHtml(
  asset: AssetSnapshot,
  config: MarketingConfig,
  photo: Buffer | Buffer[],
  story: boolean,
  fontData = "",
  logo = "",
  qrImage = "",
) {
  const money = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(asset.price);
  const facts: string[] = [];
  const specifications = [];
  if (asset.landArea && Number.isFinite(asset.landArea) && asset.landArea > 0)
    specifications.push({
      label: "Luas tanah",
      value: new Intl.NumberFormat("id-ID").format(asset.landArea) + " m²",
    });
  if (asset.certificateType)
    specifications.push({ label: "Legalitas", value: asset.certificateType });
  if (
    asset.category === "LELANG" &&
    asset.auctionDate &&
    Number.isFinite(Date.parse(asset.auctionDate))
  )
    facts.push(
      "Lelang " +
        new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "medium",
        }).format(new Date(asset.auctionDate)),
    );
  const photos = (Array.isArray(photo) ? photo : [photo]).map(
    (buffer) => "data:image/jpeg;base64," + buffer.toString("base64"),
  );
  return propertyCoverHtml({
    brand: config.companyName,
    title: asset.title,
    location: asset.address || asset.city,
    category: asset.category === "LELANG" ? "Lelang" : "Dijual",
    photo: photos[0],
    photos,
    price: money,
    priceLabel:
      asset.category === "LELANG" ? "Limit lelang" : "Harga penawaran",
    facts,
    specifications,
    contact: normalizePhone(config.companyPhone)
      ? "+" + normalizePhone(config.companyPhone)
      : config.companyName,
    listingUrl: marketingListingUrl(asset.listingUrl) || undefined,
    qrImage,
    fontData,
    logo,
    story,
  });
}
/** Fit text only after the embedded font is ready; keep full prices and titles. */
export async function fitMarketingPoster(page: any) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const heading = document.querySelector<HTMLElement>("h1");
    if (heading) {
      let size = parseFloat(getComputedStyle(heading).fontSize);
      while (heading.scrollHeight > heading.clientHeight && size > 24)
        heading.style.fontSize = --size + "px";
    }
    for (const element of document.querySelectorAll<HTMLElement>(
      ".price, .spec-value",
    )) {
      let size = parseFloat(getComputedStyle(element).fontSize);
      while (element.scrollWidth > element.clientWidth && size > 24)
        element.style.fontSize = --size + "px";
    }
  });
}

function auctionHistoryForPoster(asset: AssetSnapshot): AuctionHistoryResult {
  const toItem = (
    id: string,
    date: string | null,
    price: number,
    isCurrent: boolean,
    round: number,
  ) => ({
    id_property: id,
    urutan: round,
    is_current: isCurrent,
    judul: isCurrent ? asset.title : "",
    slug: isCurrent ? asset.slug || "" : "",
    harga: price,
    nilai_limit_lelang: price,
    harga_efektif: price,
    uang_jaminan: isCurrent ? asset.auctionDeposit ?? null : null,
    tanggal_lelang: date,
    tanggal_dibuat: null,
    gambar_utama: null,
    gambar_list: [],
    status_tayang: "TERSEDIA",
    jenis_transaksi: "LELANG",
    kelurahan: null,
    kecamatan: null,
    kota: asset.city,
    provinsi: null,
    legalitas: asset.certificateType || null,
    nomor_legalitas: null,
    nomor_legalitas_list: [],
    nomor_cocok: [],
    cakupan: "SAMA" as const,
    alamat_lengkap: asset.address,
    luas_tanah: asset.landArea,
    luas_bangunan: asset.buildingAreaSqm ?? null,
    link: null,
    id_agent: asset.agentId || null,
    confidence: "PASTI" as const,
    alasan_cocok: [],
    duplikat_ids: [],
    delta_persen: null,
  });
  const past = (asset.auctionHistoryPoints || [])
    .filter((point) => point.date && Number.isFinite(Date.parse(point.date)))
    .map((point, index) =>
      toItem(
        `history-${index + 1}`,
        point.date,
        point.price,
        false,
        index + 1,
      ),
    );
  const current = toItem(
    asset.id,
    asset.auctionDate,
    asset.price,
    true,
    past.length + 1,
  );
  return {
    ok: true,
    items: [...past, current],
    total: past.length + 1,
    total_lain: past.length,
    total_sebidang: past.length + 1,
    total_lot_terkait: 0,
    match: null,
    alasan_tanpa_riwayat: past.length ? null : "TIDAK_ADA_KECOCOKAN",
  };
}

export async function buildMarketingMedia(
  jobId: string,
  asset: AssetSnapshot,
  _config: MarketingConfig,
) {
  const photos: Buffer[] = [];
  for (const reference of asset.images) {
    const image = await fetchMarketingPhoto(reference);
    if (image)
      photos.push(
        await sharp(image)
          .rotate()
          .resize({
            width: 1800,
            height: 2200,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 88 })
          .toBuffer(),
      );
  }
  if (!photos.length) throw new MarketingError("PHOTO_UNAVAILABLE");
  const dir = path.join(mediaDirectory(), jobId);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const media: MarketingMedia[] = [];
  const posterPhotos = photos.map(
    (photo) => "data:image/jpeg;base64," + photo.toString("base64"),
  );
  const selfAgent = {
    nama: asset.agentName || undefined,
    whatsapp: asset.agentPhone || undefined,
  };
  const poster =
    asset.category === "LELANG"
      ? await renderLelangPosterImage(
          Object.assign(
            buildLelangPosterPayload(
              {
                id_property: asset.id,
                slug: asset.slug,
                judul: asset.title,
                kota: asset.sourceCityName || asset.city,
                alamat_lengkap: asset.address,
                luas_tanah: asset.landArea,
                luas_bangunan: asset.buildingAreaSqm,
                legalitas: asset.certificateType,
                nilai_limit_lelang: asset.sourceLimitPrice,
                harga: asset.sourcePrice ?? asset.price,
                uang_jaminan: asset.auctionDeposit,
                tanggal_lelang: asset.auctionDate,
                agent: {
                  nama: asset.agentName,
                  whatsapp: asset.agentPhone,
                },
              },
              {
                agentCode: asset.agentId,
                selfAgent,
                riwayatLelang: auctionHistoryForPoster(asset),
                origin: SITE_URL,
              },
            ),
            { photos: posterPhotos },
          ),
        )
      : await renderJualPosterImage(
          Object.assign(
            buildJualPosterData(
              {
                id_property: asset.id,
                slug: asset.slug,
                jenis_transaksi: asset.category,
                judul: asset.title,
                kota: asset.sourceCityName || asset.city,
                alamat_lengkap: asset.address,
                luas_tanah: asset.landArea,
                luas_bangunan: asset.buildingAreaSqm,
                kamar_tidur: asset.bedroomCount,
                kamar_mandi: asset.bathroomCount,
                jumlah_lantai: asset.floorCount,
                legalitas: asset.certificateType,
                harga: asset.sourcePrice ?? asset.price,
                harga_promo: asset.sourcePromoPrice,
                agent: {
                  nama: asset.agentName,
                  whatsapp: asset.agentPhone,
                },
              },
              {
                agentCode: asset.agentId,
                selfAgent,
                origin: SITE_URL,
              },
            ),
            { photos: posterPhotos },
          ),
        );
  const storyName = "story.jpg";
  await writeFile(path.join(dir, storyName), poster, { mode: 0o600 });
  media.push({
    name: storyName,
    channel: "whatsapp",
    width: 1080,
    height: 1920,
  });
  const feedName = "feed.jpg";
  const feedPoster = await sharp(poster)
    .resize(1080, 1350, { fit: "contain", background: "#FFFFFF" })
    .jpeg({ quality: 88 })
    .toBuffer();
  await writeFile(path.join(dir, feedName), feedPoster, { mode: 0o600 });
  media.push({
    name: feedName,
    channel: "instagram",
    width: 1080,
    height: 1350,
  });
  for (let i = 0; i < photos.length; i++) {
    const name = "photo-" + (i + 1) + ".jpg";
    await writeFile(
      path.join(dir, name),
      await sharp(photos[i])
        .resize(1080, 1350, { fit: "contain", background: "#F7F4EC" })
        .jpeg({ quality: 88 })
        .toBuffer(),
      { mode: 0o600 },
    );
    media.push({ name, channel: "instagram", width: 1080, height: 1350 });
  }
  return media;
}
export async function probePublicMedia(jobId: string) {
  publicOrigin();
  try {
    const local = await readMarketingMedia(jobId, "feed.jpg");
    const response = await fetch(mediaUrl(jobId, "feed.jpg"), {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/jpeg")
    )
      throw new Error();
    const remote = Buffer.from(await response.arrayBuffer());
    if (!remote.equals(local)) throw new Error();
  } catch {
    throw new MarketingError("MEDIA_NOT_PUBLIC", 503);
  }
}
