import { randomBytes } from 'node:crypto';
import { ServiceError, logFailure } from '../lib/http.js';
import { needsAuctionCheck } from './auction_check.js';

export const STOCK_CONFIRMATION_VERSION = '2026-10-17-durable-stoker-v1';

const line = (value) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f*]/g, ' ').replace(/\s+/g, ' ').trim() : '';

export function stockConfirmationMessage(asset) {
  if (!/^[A-Z0-9][A-Z0-9-]{0,49}$/i.test(asset?.id) || !Number.isFinite(Date.parse(asset.auction_at))) throw new ServiceError('INVALID_ASSET_CHECK', 400);
  const address = line(asset.full_address) || Object.values(asset.address || {}).map(line).filter(Boolean).join(', ') || line(asset.location) || 'Lokasi belum dicantumkan';
  let url = `https://solusindoaset.com/Lelang/properti-${asset.id}`;
  try {
    const detail = new URL(asset.detail_url);
    if (detail.protocol === 'https:' && ['solusindoaset.com', 'www.solusindoaset.com'].includes(detail.hostname) &&
      !detail.username && !detail.password && !detail.search && !detail.hash &&
      /^\/Lelang\/[a-z0-9-]+$/i.test(detail.pathname) && detail.pathname.endsWith(`-${asset.id}`) && detail.href.length <= 1000) url = detail.href;
  } catch { /* The public detail route also resolves a missing slug by ID. */ }
  const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(asset.auction_at));
  return `🔍 *Konfirmasi Stok Properti*\n\n🆔 *ID:* ${asset.id}\n📍 *Lokasi:* ${address.slice(0, 1600)}\n📅 *Tanggal Lelang:* ${date}\n\n❓ Apakah aset ini masih *TERSEDIA* atau sudah *TERJUAL*?\n\nAda respon dari klien kami yang sedang menanyakan. Mohon konfirmasi segera. 🙏\n\n🔗 *Lihat detail properti:*\n${url}`;
}

// Only known pre-send failures are retried automatically. A timeout can mean
// WhatsApp accepted a message: preserve it for review instead of sending twice.
export class StockConfirmation {
  constructor({ checks, whatsapp, recipient, transport, catalog, logger = console, now = Date.now }) {
    Object.assign(this, { checks, whatsapp, recipient, transport, catalog, logger, now });
    this.running = null;
    this.stopped = false;
  }

  async enqueue({ contact, asset }) {
    if (!needsAuctionCheck(asset, this.now())) return null;
    const task = this.checks.enqueue({ contact, asset, notification: {
      recipient: this.recipient, body: stockConfirmationMessage(asset), messageId: `3EB0${randomBytes(18).toString('hex').toUpperCase()}`,
    } });
    if (task.status === 'pending' && task.notification_id) await this.flush(task.notification_id);
    return this.checks.get(task.id);
  }

  list() { return this.checks.list(); }
  complete(id, confirmation) { return this.checks.complete(id, confirmation); }
  stockResult(asset) { return this.checks.stockResult(asset); }
  async retry(id) { this.checks.retryNotification(id); await this.flush(this.checks.get(id).notification_id); return { id, status: 'pending' }; }

  async flush(preferredId) {
    // A customer must not wait behind a whole backlog. The periodic worker
    // picks up any new row queued while this pass is already running.
    if (this.stopped || this.running) return;
    this.running = this.sendDue(preferredId, preferredId ? 1 : 25);
    try { await this.running; }
    catch (error) { logFailure(this.logger, 'stock_confirmation_worker_failed', error); }
    finally { this.running = null; }
  }

  async sendDue(preferredId, limit) {
    for (let count = 0; count < limit && !this.stopped; count++) {
      const initialRequest = !!preferredId;
      const notification = this.checks.claimNotification(preferredId);
      preferredId = null;
      if (!notification) break;
      let status = 'uncertain', code = null;
      try {
        if (notification.recipient !== this.recipient) throw new ServiceError('STOCK_RECIPIENT_CHANGED', 409);
        if (this.transport !== 'baileys') throw new ServiceError('STOCK_REQUIRES_BAILEYS', 409);
        const connection = this.whatsapp.getStatus();
        if (!connection.connected) throw new ServiceError('WHATSAPP_NOT_CONNECTED', 503);
        if (connection.phone === notification.recipient) throw new ServiceError('STOCK_RECIPIENT_IS_SENDER', 409);
        // Delayed/retried work must still refer to the same available, expired
        // lot. A schedule/status update while offline must not send stale SOPs.
        if (this.catalog && (!initialRequest || notification.attempts > 0)) {
          let current;
          try {
            current = this.catalog.resolve
              ? (await this.catalog.resolve(`Kode ${notification.asset_id}`, notification.asset_id)).asset
              : await this.catalog.get(notification.asset_id);
          } catch { throw new ServiceError('STOCK_CATALOG_UNAVAILABLE', 503); }
          if (!current || current.id !== notification.asset_id || !needsAuctionCheck(current, this.now()) ||
            new Date(current.auction_at).toISOString() !== notification.auction_at) throw new ServiceError('STOCK_ASSET_CHANGED', 409);
        }
        const messageId = await this.whatsapp.sendText(notification.recipient, notification.body, undefined, { messageId: notification.message_id });
        if (!messageId) throw new ServiceError('INVALID_WA_RESPONSE', 502);
        status = 'sent';
      } catch (error) {
        code = error.code || 'WA_SEND_UNCERTAIN';
        if (['WHATSAPP_NOT_CONNECTED', 'STOCK_CATALOG_UNAVAILABLE'].includes(code)) status = 'retry';
        else if (['STOCK_REQUIRES_BAILEYS', 'STOCK_RECIPIENT_IS_SENDER', 'STOCK_RECIPIENT_CHANGED', 'STOCK_ASSET_CHANGED', 'INVALID_OUTBOUND_MESSAGE'].includes(code)) status = 'failed';
        logFailure(this.logger, 'stock_confirmation_send_failed', error);
      }
      this.checks.finishNotification(notification.id, notification.lease_token, { status, code });
    }
  }

  async stop() { this.stopped = true; await this.running; }
}
