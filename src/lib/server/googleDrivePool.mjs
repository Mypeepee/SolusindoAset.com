import { randomUUID } from 'node:crypto';

export const DRIVE_LEGACY_FOLDERS = {
  properties: '1kuYnWDVAhnCKSDmggY0feZerMTsD62BC',
  agents: '1u8faFug3GV3lB6y0L2TbwEX48IPAUtiQ',
  attachments: '1yMtRi1DbiINlGSFzHzGj-MT8f7C-UANJ',
};
const API = 'https://www.googleapis.com/drive/v3';
const GLOBAL = Symbol.for('kosku.google-drive.cache.v1');
const cache = globalThis[GLOBAL] ||= { tokens: new Map(), folders: new Map(), quota: new Map() };

export class DriveUploadError extends Error {
  constructor(message, { status = 502, reason = 'driveError', accountId = '', committed = false } = {}) {
    super(message);
    this.name = 'DriveUploadError'; this.status = status; this.reason = reason;
    this.accountId = accountId; this.committed = committed;
  }
}

export function environmentDriveAccounts(env = process.env) {
  const accounts = [];
  const primaryToken = env.GOOGLE_DRIVE_REFRESH_TOKEN || env.GOOGLE_REFRESH_TOKEN;
  const clientId = env.GOOGLE_DRIVE_CLIENT_ID || env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET;
  if (primaryToken && clientId && clientSecret) accounts.push({
    id: 'primary', label: 'Google Drive 1', clientId, clientSecret, refreshToken: primaryToken,
    roots: {
      properties: env.GOOGLE_DRIVE_FOLDER || DRIVE_LEGACY_FOLDERS.properties,
      agents: env.GDRIVE_PARENT_FOLDER_ID || env.GOOGLE_DATA_AGENT_FOLDER_ID || DRIVE_LEGACY_FOLDERS.agents,
      attachments: env.GOOGLE_DRIVE_ATTACHMENTS_FOLDER || DRIVE_LEGACY_FOLDERS.attachments,
    },
  });
  if (env.GOOGLE_DRIVE_2_REFRESH_TOKEN) {
    const secondId = env.GOOGLE_DRIVE_2_CLIENT_ID || clientId;
    const secondSecret = env.GOOGLE_DRIVE_2_CLIENT_SECRET || clientSecret;
    if (!secondId || !secondSecret) throw new DriveUploadError('Konfigurasi OAuth Google Drive kedua belum lengkap.', { reason: 'configuration', status: 503 });
    accounts.push({
      id: 'secondary', label: 'Google Drive 2', clientId: secondId, clientSecret: secondSecret,
      refreshToken: env.GOOGLE_DRIVE_2_REFRESH_TOKEN,
      // Never reuse primary folder IDs for another account.
      roots: {
        properties: env.GOOGLE_DRIVE_2_FOLDER || null,
        agents: env.GOOGLE_DRIVE_2_AGENT_FOLDER || null,
        attachments: env.GOOGLE_DRIVE_2_ATTACHMENTS_FOLDER || null,
      },
    });
  }
  return accounts;
}

const escapeQuery = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const safeName = value => String(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().slice(0, 200) || 'Dokumen';
const purposeLabels = { properties: 'Foto Properti', agents: 'Data Agen', attachments: 'Lampiran Lelang' };

/** Native REST implementation shared by Next routes and the standalone scraper.
 * External requests are injectable; regression tests never upload real files.
 */
export function createDrivePool({ accounts = () => environmentDriveAccounts(), fetchImpl = globalThis.fetch, now = () => Date.now(), sharedCache = cache } = {}) {
  async function configured() {
    const list = await accounts();
    const seen = new Set();
    return list.filter(account => {
      const key = `${account.clientId}:${account.refreshToken}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  function key(account) { return `${account.id}:${account.clientId}:${account.refreshToken}`; }

  async function accessToken(account, deadline) {
    const tokenKey = key(account);
    const existing = sharedCache.tokens.get(tokenKey);
    if (existing && existing.until > now()) return existing.promise;
    const promise = (async () => {
      const response = await timedFetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: account.clientId, client_secret: account.clientSecret,
          refresh_token: account.refreshToken, grant_type: 'refresh_token' }),
      }, deadline);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) throw new DriveUploadError(`Koneksi ${account.label} perlu disambungkan ulang.`, { status: 503, reason: 'authorization', accountId: account.id });
      sharedCache.tokens.set(tokenKey, { promise: Promise.resolve(data.access_token), until: now() + Math.max(1, Number(data.expires_in || 3600) - 60) * 1000 });
      return data.access_token;
    })();
    sharedCache.tokens.set(tokenKey, { promise, until: now() + 20_000 });
    try { return await promise; }
    catch (error) { sharedCache.tokens.delete(tokenKey); throw error; }
  }

  async function timedFetch(url, init, deadline) {
    const remaining = Math.min(30_000, deadline - now());
    if (remaining <= 0) throw new DriveUploadError('Upload melewati batas waktu. Periksa koneksi lalu coba lagi.', { reason: 'timeout', status: 504 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'error' });
      // Consume the response while the abort timer is active, including the body.
      const bytes = await response.arrayBuffer();
      return new Response(bytes.byteLength ? bytes : null, { status: response.status, headers: response.headers });
    } catch {
      throw new DriveUploadError('Google Drive belum memberi hasil upload yang pasti. Periksa berkas sebelum mencoba lagi.', { reason: controller.signal.aborted ? 'timeout' : 'network', status: 504 });
    } finally { clearTimeout(timer); }
  }

  async function request(account, url, init = {}, deadline = now() + 50_000) {
    const token = await accessToken(account, deadline);
    const response = await timedFetch(url.startsWith('https:') ? url : API + url, {
      ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers },
    }, deadline);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const reason = data.error?.errors?.[0]?.reason || (response.status === 404 ? 'notFound' : 'driveError');
      const message = reason === 'storageQuotaExceeded' ? `${account.label} penuh.`
        : response.status === 401 ? `Koneksi ${account.label} perlu disambungkan ulang.`
        : ['insufficientFilePermissions', 'insufficientPermissions'].includes(reason) ? `Izin folder ${account.label} belum sesuai.`
        : `Google Drive gagal memproses permintaan (HTTP ${response.status}).`;
      throw new DriveUploadError(message, { status: response.status, reason, accountId: account.id });
    }
    return response.status === 204 ? {} : response.json();
  }

  async function quota(account, deadline, force = false) {
    const accountKey = key(account);
    const existing = sharedCache.quota.get(accountKey);
    if (!force && existing?.until > now()) return existing.value;
    const value = await request(account, '/about?fields=user(emailAddress,displayName,permissionId),storageQuota', {}, deadline);
    sharedCache.quota.set(accountKey, { value, until: now() + 15_000 });
    return value;
  }

  async function folder(account, parent, name, deadline) {
    name = safeName(name);
    const folderKey = `${key(account)}:${parent}:${name}`;
    const existing = sharedCache.folders.get(folderKey);
    if (existing?.until > now()) return existing.promise;
    const promise = (async () => {
      const query = `name='${escapeQuery(name)}' and '${escapeQuery(parent)}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const params = new URLSearchParams({ q: query, fields: 'files(id)', pageSize: '1', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
      const found = await request(account, '/files?' + params, {}, deadline);
      if (found.files?.[0]?.id) return found.files[0].id;
      const created = await request(account, '/files?supportsAllDrives=true&fields=id', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
      }, deadline);
      if (!created.id) throw new DriveUploadError('Google Drive tidak mengembalikan folder upload.');
      return created.id;
    })();
    sharedCache.folders.set(folderKey, { promise, until: now() + 300_000 });
    try { return await promise; }
    catch (error) { sharedCache.folders.delete(folderKey); throw error; }
  }

  async function upload({ buffer, name, mimeType, purpose = 'properties', folders = [], publicRead = false, primaryParent = null }) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new DriveUploadError('Berkas upload kosong.', { status: 400, reason: 'validation' });
    if (!purposeLabels[purpose]) throw new DriveUploadError('Tujuan upload tidak dikenal.', { status: 400, reason: 'validation' });
    const list = await configured();
    if (!list.length) throw new DriveUploadError('Belum ada akun Google Drive yang tersambung.', { status: 503, reason: 'configuration' });
    const deadline = now() + 50_000;
    for (const account of list) {
      try {
        const info = await quota(account, deadline);
        const limit = info.storageQuota?.limit;
        const usage = info.storageQuota?.usage;
        if (limit != null && usage != null && BigInt(usage) + BigInt(buffer.length) > BigInt(limit)) continue;
        let parent = account.id === 'primary' && primaryParent ? primaryParent : account.roots?.[purpose];
        if (!parent) {
          const appFolder = await folder(account, 'root', 'Solusindo Aset', deadline);
          parent = await folder(account, appFolder, purposeLabels[purpose], deadline);
        }
        for (const name of folders) parent = await folder(account, parent, name, deadline);
        const boundary = `kosku-${randomUUID()}`;
        const metadata = { name: safeName(name), parents: [parent] };
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
          buffer, Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);
        const file = await request(account, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
          method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: new Uint8Array(body),
        }, deadline);
        if (!file.id) throw new DriveUploadError('Google Drive tidak mengembalikan ID berkas.');
        if (publicRead) {
          try {
            await request(account, `/files/${encodeURIComponent(file.id)}/permissions?supportsAllDrives=true`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }),
            }, deadline);
          } catch (error) {
            // This file belongs to this request. Do not re-upload it on another
            // account if setting its requested sharing policy fails.
            await request(account, `/files/${encodeURIComponent(file.id)}?supportsAllDrives=true`, { method: 'DELETE' }, deadline).catch(() => {});
            throw new DriveUploadError('Berkas belum dapat dibagikan sesuai kebutuhan aplikasi. Periksa izin Google Drive lalu coba lagi.', { reason: 'sharing', committed: true });
          }
        }
        sharedCache.quota.delete(key(account));
        return { fileId: file.id, accountId: account.id, url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000` };
      } catch (error) {
        if (!(error instanceof DriveUploadError) || error.reason !== 'storageQuotaExceeded' || error.committed) throw error;
        sharedCache.quota.set(key(account), { value: { storageQuota: { limit: '0', usage: '0' } }, until: now() + 30_000 });
      }
    }
    throw new DriveUploadError('Penyimpanan semua akun Google Drive penuh. Tambahkan kapasitas atau sambungkan akun lain.', { status: 507, reason: 'storageQuotaExceeded' });
  }

  async function forFile(fileId, operation) {
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) throw new DriveUploadError('ID berkas Google Drive tidak valid.', { status: 400, reason: 'validation' });
    const list = await configured();
    for (const account of list) {
      try { return await operation(account); }
      catch (error) {
        if (!(error instanceof DriveUploadError) || ![403, 404].includes(error.status)) throw error;
      }
    }
    throw new DriveUploadError('Berkas tidak ditemukan atau akun Drive pemiliknya belum tersambung.', { status: 404, reason: 'notFound' });
  }

  return {
    upload,
    accounts: configured,
    status: async () => Promise.all((await configured()).map(async account => {
      try {
        const info = await quota(account, now() + 15_000, true);
        return { id: account.id, label: account.label, email: info.user?.emailAddress || null,
          storage: info.storageQuota || null, connected: true, error: null };
      } catch (error) { return { id: account.id, label: account.label, email: null, storage: null, connected: false, error: error instanceof DriveUploadError ? error.message : 'Gagal memeriksa koneksi.' }; }
    })),
    getFileInfo: fileId => forFile(fileId, account => request(account, `/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,thumbnailLink`)),
    deleteFile: fileId => forFile(fileId, account => request(account, `/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: 'DELETE' })),
  };
}
