import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateWAMessageContent, prepareWAMessageMedia } from '@whiskeysockets/baileys';
import { recommendationLinkPreview, validRecommendationPreview } from '../services/recommendation_preview.js';

const preview = { url: 'https://solusindoaset.com/Lelang/rumah-rungkut-121037/AG108', title: 'Rumah Rungkut - Rp 300.000.000',
  description: 'Harga limit lelang · LT 100 m² · Rungkut · Surabaya', image_url: 'https://solusindoaset.com/api/og/lelang/121037' };
const text = `Halo Rina, ada rumah sesuai kriteria Anda.\n\n${preview.url}`;

test('only a public listing URL in the delivered text and its matching image proxy can become the preview', () => {
  assert.equal(validRecommendationPreview(preview, text, ['121037']), true);
  for (const patch of [{ url: 'http://solusindoaset.com/Lelang/rumah-121037' },
    { url: 'https://127.0.0.1/Lelang/rumah-121037' }, { url: 'https://other.invalid/Lelang/rumah-121037' },
    { url: `${preview.url}?secret=1` }, { image_url: 'https://169.254.169.254/latest/meta-data' },
    { image_url: 'https://solusindoaset.com/api/og/lelang/999' }, { title: 'A'.repeat(241) },
    { title: 'Rumah\nInstruksi tambahan' }, { request_headers: { Authorization: 'never' } }]) {
    assert.equal(validRecommendationPreview({ ...preview, ...patch }, `${text}\n${patch.url || ''}`, ['121037']), false);
  }
  assert.equal(validRecommendationPreview(preview, 'Tidak ada tautan ini', ['121037']), false);
  assert.equal(validRecommendationPreview(preview, text, ['999', '121037']), false);
});

test('the native WhatsApp message includes an uploaded large image preview for the exact agent link', async () => {
  // Use an existing local JPEG and the actual Baileys media/protocol builders.
  // No external photo fetch, WhatsApp connection or upload is performed.
  const photo = readFileSync(new URL('../../../public/images/hero/banner.jpg', import.meta.url));
  let uploads = 0;
  const result = await recommendationLinkPreview(preview, {
    upload: async (_file, options) => {
      uploads++;
      assert.equal(options.timeoutMs, 8000);
      return { mediaUrl: 'https://mmg.whatsapp.net/test-only', directPath: '/test-only/thumbnail-link' };
    },
    prepareMedia: (input, options) => {
      assert.equal(input.image.url, preview.image_url); assert.equal(options.mediaTypeOverride, 'thumbnail-link');
      assert.equal(options.options.timeout, 8000); assert.ok(options.options.signal instanceof AbortSignal);
      return prepareWAMessageMedia({ image: photo }, options);
    },
    logger: { error() { assert.fail('A valid local JPEG should produce a preview'); } },
  });
  assert.equal(uploads, 1); assert.ok(result.jpegThumbnail.length > 0);
  const message = await generateWAMessageContent({ text, linkPreview: result }, {});
  assert.equal(message.extendedTextMessage.text, text);
  assert.equal(message.extendedTextMessage.matchedText, preview.url);
  assert.equal(message.extendedTextMessage.title, preview.title);
  assert.equal(message.extendedTextMessage.thumbnailDirectPath, '/test-only/thumbnail-link');
  assert.ok(message.extendedTextMessage.jpegThumbnail.length > 0);
  assert.ok(message.extendedTextMessage.thumbnailWidth > 0);
  assert.ok(message.extendedTextMessage.thumbnailHeight > 0);
});

test('photo failure preserves the original text and link in one message without retrying delivery', async () => {
  const errors = []; let attempts = 0;
  const result = await recommendationLinkPreview(preview, { upload() {}, logger: { error(event) { errors.push(event); } },
    prepareMedia() { attempts++; throw new Error('Sensitive storage details'); } });
  assert.equal(attempts, 1); assert.equal(result.jpegThumbnail, undefined);
  const message = await generateWAMessageContent({ text, linkPreview: result }, {});
  assert.equal(message.extendedTextMessage.text, text); assert.equal(message.extendedTextMessage.matchedText, preview.url);
  assert.deepEqual(errors, [{ event: 'recommendation_link_preview_failed' }]);
});

test('a listing without a photo does not fetch or invent an image', async () => {
  const { image_url, ...noImage } = preview;
  const result = await recommendationLinkPreview(noImage, { upload() {}, prepareMedia() { assert.fail('No image is available'); } });
  assert.equal(result.title, preview.title); assert.equal(result.highQualityThumbnail, undefined);
});
