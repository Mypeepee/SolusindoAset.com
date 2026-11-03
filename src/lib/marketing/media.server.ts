import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import QRCode from "qrcode";
import { resolveFetchableImage } from "@/lib/fotoListing";
import { renderStoryPoster } from "@/lib/server/posterRender";
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
export async function buildMarketingMedia(
  jobId: string,
  asset: AssetSnapshot,
  config: MarketingConfig,
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
  const fontData = (
    await readFile(
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "plus-jakarta-sans",
        "PlusJakartaSans-Variable.ttf",
      ),
    )
  ).toString("base64");
  const logo =
    "data:image/png;base64," +
    (
      await readFile(
        path.join(process.cwd(), "public/images/logo/LogoSolusindoPremier.png"),
      )
    ).toString("base64");
  const listingUrl = marketingListingUrl(asset.listingUrl);
  const qrImage = listingUrl
    ? await QRCode.toDataURL(listingUrl, {
        width: 360,
        margin: 3,
        errorCorrectionLevel: "M",
      })
    : "";
  for (const story of [false, true]) {
    const name = story ? "story.jpg" : "feed.jpg",
      height = story ? 1920 : 1350;
    const buffer = await renderStoryPoster(
      posterHtml(asset, config, photos, story, fontData, logo, qrImage),
      fitMarketingPoster,
      { width: 1080, height, deviceScaleFactor: 1 },
    );
    await writeFile(path.join(dir, name), buffer, { mode: 0o600 });
    media.push({
      name,
      channel: story ? "whatsapp" : "instagram",
      width: 1080,
      height,
    });
  }
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
