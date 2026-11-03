import { prepareWAMessageMedia } from '@whiskeysockets/baileys';

// Only the authenticated recommendation API may supply this descriptor. The
// image is fetched through our fixed public photo proxy, never a listing's raw
// URL or a URL supplied by the customer.
export function validRecommendationPreview(value, text, propertyIds) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['url', 'title', 'description', 'image_url'].includes(key)) ||
      typeof value.url !== 'string' || value.url.length > 600 || !text.includes(value.url) ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 240 ||
      typeof value.description !== 'string' || value.description.length > 300 ||
      /[\u0000-\u001f\u007f]/.test(value.title + value.description)) return false;
  try {
    const url = new URL(value.url);
    const id = /^\/(?:Lelang|Jual|Sewa)\/[a-z0-9-]+-([1-9]\d{0,17})(?:\/AG\d{1,18})?$/.exec(url.pathname)?.[1];
    if (url.protocol !== 'https:' || !['solusindoaset.com', 'www.solusindoaset.com'].includes(url.hostname) ||
        url.username || url.password || url.port || url.search || url.hash || !id || propertyIds && propertyIds[0] !== id) return false;
    return value.image_url == null || value.image_url === `${url.origin}/api/og/lelang/${id}`;
  } catch { return false; }
}

export async function recommendationLinkPreview(value, { upload, prepareMedia = prepareWAMessageMedia, logger = console } = {}) {
  const preview = { 'canonical-url': value.url, 'matched-text': value.url, title: value.title, description: value.description };
  if (!value.image_url || typeof upload !== 'function') return preview;
  try {
    const { imageMessage } = await prepareMedia({ image: { url: value.image_url } }, {
      upload, mediaTypeOverride: 'thumbnail-link', mediaUploadTimeoutMs: 8000,
      options: { timeout: 8000, signal: AbortSignal.timeout(8000) },
    });
    if (imageMessage) return { ...preview, originalThumbnailUrl: value.image_url,
      ...(imageMessage.jpegThumbnail ? { jpegThumbnail: Buffer.from(imageMessage.jpegThumbnail) } : {}),
      highQualityThumbnail: imageMessage };
  } catch {
    // Photo failure must not retry a WhatsApp send or lose the text/selection
    // context. Fall back to a titled link within the same outbound message.
    logger.error({ event: 'recommendation_link_preview_failed' });
  }
  return preview;
}
