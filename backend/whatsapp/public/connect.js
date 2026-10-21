const el = (id) => document.getElementById(id);
let token = new URLSearchParams(location.hash.slice(1)).get('token') || sessionStorage.getItem('wa-admin-token') || '';
history.replaceState(null, '', '/connect');
if (token) sessionStorage.setItem('wa-admin-token', token);
let busy = false;
let state = '';
const labels = { pairing: 'Menyelesaikan pemasangan…', connecting: 'Menghubungkan…', awaiting_scan: 'Scan QR untuk menyambungkan', awaiting_code: 'Menunggu kode dimasukkan di ponsel', requesting_code: 'Membuat kode pairing…', connected: 'Tersambung', reconnecting: 'Menyambungkan kembali…', logged_out: 'Sesi WhatsApp sudah keluar', replaced: 'Sesi digunakan di tempat lain', bad_session: 'Sesi perlu dipasangkan ulang', forbidden: 'Koneksi ditolak WhatsApp', auth_error: 'Sesi tidak dapat disimpan', connection_failed: 'Koneksi belum berhasil', stopped: 'Koneksi berhenti' };
const errors = { PAIRING_NOT_READY: 'Tunggu sampai QR muncul sebelum meminta kode.', PAIRING_RATE_LIMIT: 'Tunggu satu menit sebelum meminta kode baru.', INVALID_PHONE: 'Isi nomor internasional seperti 6281234567890.', PAIR_AGAIN_REQUIRED: 'Pilih Pasangkan ulang untuk membuat sesi baru.', WHATSAPP_NOT_CONNECTED: 'WhatsApp belum tersambung.', CONVERSATION_BUSY: 'Tunggu percakapan yang sedang diproses selesai.' };

async function api(path, options = {}) {
  const response = await fetch(`/admin/whatsapp/${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
  if (response.status === 401) {
    token = ''; sessionStorage.removeItem('wa-admin-token');
    throw new Error('Akses belum valid. Masukkan token admin lokal atau buka dengan npm run connect.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(errors[data.error] || 'Permintaan belum berhasil. Coba lagi setelah koneksi stabil.');
  return data;
}

function showError(message) { el('error').textContent = message; el('error').hidden = !message; }

async function refresh() {
  if (busy) return;
  el('login').hidden = !!token; el('panel').hidden = !token;
  if (!token) return;
  busy = true;
  try {
    const status = await api('status');
    state = status.status;
    el('status').textContent = labels[state] || state;
    el('dot').classList.toggle('connected', status.connected);
    el('detail').textContent = status.connected ? `Nomor terhubung: ${status.phone || 'akun WhatsApp Anda'}` : 'QR diperbarui otomatis. Pemasangan diselesaikan melalui WhatsApp di ponsel Anda.';
    el('connected').hidden = !status.connected;
    el('received').textContent = String(status.received || 0); el('sent').textContent = String(status.sent || 0);
    el('pairing-options').hidden = status.connected;
    el('request-code').disabled = state !== 'awaiting_scan';
    el('reconnect').hidden = !['connection_failed', 'stopped', 'awaiting_code'].includes(state);
    el('reset').hidden = !['logged_out', 'bad_session', 'forbidden', 'replaced', 'auth_error'].includes(state);
    const pairing = status.qr_ready || status.pairing_code_ready ? await api('pairing') : {};
    el('qr-section').hidden = !pairing.qr;
    if (pairing.qr && el('qr').src !== pairing.qr) el('qr').src = pairing.qr;
    if (!pairing.qr) el('qr').removeAttribute('src');
    el('code-section').hidden = !pairing.code;
    el('pairing-code').textContent = pairing.code ? pairing.code.match(/.{1,4}/g).join('-') : '';
  } catch (error) { showError(error.message); }
  finally { busy = false; el('login').hidden = !!token; }
}

el('login-form').addEventListener('submit', (event) => {
  event.preventDefault(); token = el('token').value.trim(); el('token').value = '';
  sessionStorage.setItem('wa-admin-token', token); showError(''); refresh();
});
el('pairing-form').addEventListener('submit', async (event) => {
  event.preventDefault(); el('request-code').disabled = true; showError('');
  try { await api('pairing-code', { method: 'POST', body: JSON.stringify({ phone: el('phone').value.trim() }) }); }
  catch (error) { showError(error.message); }
  await refresh();
});
for (const reset of [false, true]) el(reset ? 'reset' : 'reconnect').addEventListener('click', async () => {
  if (reset && !window.confirm('Buat sesi WhatsApp baru? Riwayat dan antrean lead sementara pada backend ini akan dihapus.')) return;
  showError('');
  try { await api('reconnect', { method: 'POST', body: JSON.stringify({ reset }) }); }
  catch (error) { showError(error.message); }
  await refresh();
});
refresh();
setInterval(refresh, 2000);
