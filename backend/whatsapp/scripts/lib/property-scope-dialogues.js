import assert from 'node:assert/strict';
import { MessageProcessor } from '../../services/message_processor.js';
import { MemoryStore } from '../../state/memory_store.js';
import { INTRODUCTION_MESSAGE } from '../../services/client_identity.js';

export const propertySearchSamples = [
  'Pak tolong carikan saya aset property',
  'Mohon bantu mencari rumah di Surabaya.',
  'Saya ingin membeli rumah di Surabaya',
  'sy pgn rmh di Surabaya pak',
  'bro cariin rmh dong di Sidoarjo',
  'nyari rmah daerah Benowo nih min',
  'Bu, ada rumah lelang di Surabaya?',
  'ada tanah di Gresik nggak?',
  'Butuh gudang di Sidoarjo untuk usaha',
  'Tolong carikan ruko untuk usaha saya',
  'Saya mau rumah baru dari developer',
  'Saya cari rumah secondary di Benowo',
  'Cari kos di Surabaya dong',
  'Bisa bantu cari apartemen di Surabaya?',
  'Pak, carikan tanah buat bangun rumah',
  'Saya mau sewa ruko di Gresik',
  'Pengen rumah di Sidoarjo',
  'Pingin punya rumah di Surabaya',
  'Cari pabrik di Gresik pak',
  'Mencari vila di Malang',
  'Ada toko di Surabaya?',
  'Cari rumah dekat lapangan bola',
  'Saya butuh rumah dengan garasi mobil',
  'Cari rumah dekat rumah sakit',
  'Nyari rumah buat keluarga tinggal',
  'Cari aset lelang, budget 500 juta',
  'Cari proeprty di Surabaya pak',
  'Saya tertarik aset lelang di Surabaya',
  'Mau rumah untuk investasi di Gresik',
  'Tolong cari rumah di Surabaya. Btw invoice proyek besok ya',
];

export const unrelatedSamples = [
  'Pak tolong kirim invoice proyek desain kemarin',
  'Invoice di Surabaya 250 juta, bisa dicek?',
  'Jadwal rapat besok jam berapa?',
  'Lokasi meeting di Surabaya ya',
  'Tolong revisi laporan kerja saya',
  'Proposal kerja sama sudah dibaca?',
  'Bisa buat presentasi untuk rapat?',
  'Ada lowongan kerja di Surabaya?',
  'Saya mau kirim lamaran kerja',
  'Tolong cek CV saya',
  'Kapan gaji bulan ini dibayar?',
  'Minta izin cuti besok',
  'Tolong desain website properti saya',
  'Bisa buat aplikasi lelang?',
  'Saya cari kerja di rumah',
  'Rapat di rumah saya besok ya',
  'Tolong antar dokumen ke rumah',
  'Bisa jemput saya di rumah?',
  'Kirim paket ke alamat rumah saya',
  'Bantu buat coding javascript',
  'Tolong debug python saya',
  'Saya mau sewa mobil di Surabaya',
  'Carikan motor bekas budget 20 juta',
  'Ada lelang mobil di Jakarta?',
  'Harga laptop di Surabaya berapa?',
  'Bisa nego harga mobilnya?',
  'Mau survei kepuasan karyawan',
  'Tolong urus sertifikat pelatihan kerja',
  'Minta rekening perusahaan buat bayar invoice',
  'Apa password pengguna?',
  'Buat pantun dong',
  'Cuaca di Surabaya gimana?',
  'Bola tadi malam siapa yang menang?',
  'Ada rekomendasi film?',
  'Tolong buat resep nasi goreng',
  'Cari katering di Sidoarjo',
  'Saya mau beli tiket pesawat ke Surabaya',
  'Mau bahas politik sebentar',
  'Gimana kabar rumah tangga artis itu?',
  'Saya bukan soal properti, mau bahas pekerjaan',
];

const NOW = Date.parse('2026-10-21T03:00:00Z'), PHONE = '6281234567890';
export function scopeFixture(aiOverrides = {}) {
  const config = { transport: 'baileys', maxSessions: 100, maxPending: 100, maxPendingPerPhone: 20,
    maxDedup: 1000, sessionTtlMs: 86400000, sessionIdleMs: 45 * 60000 };
  const store = new MemoryStore(config, () => NOW), sent = [], reads = [], calls = [], transcripts = [];
  const catalog = { async resolve(text, previousId, criteria) {
    reads.push({ text, previousId, criteria: structuredClone(criteria) });
    const id = /\bKode\s+(\d+)/i.exec(text)?.[1] || previousId;
    return { status: id ? 'matched' : 'not_found', catalog: [], source: 'simulation', asset: id ? {
      id, transaction_type: 'SECONDARY', name: 'Rumah simulasi', location: 'Benowo', address: { city: 'Surabaya', district: 'Benowo' },
      limit_price: 500000000, publication: { status: 'TERSEDIA' },
    } : null };
  } };
  const ai = { async generate(input) { calls.push(input); return { reply: 'Harga properti yang sedang dibahas tercatat Rp500 juta.', qualification: {} }; }, ...aiOverrides };
  const processor = new MessageProcessor({ config, store, catalog, ai, now: () => NOW, logger: { error() {} },
    whatsapp: { async sendText(_to, text) { sent.push(text); return 'simulated'; } } });
  let sequence = 0;
  const send = async (text) => {
    const before = sent.length;
    processor.acceptBatch([{ id: `scope-${++sequence}`, from: PHONE, type: 'text', text, timestamp: NOW }]);
    await processor.drain();
    const replies = sent.slice(before);
    transcripts.push({ user: text, replies, ignored: replies.length === 0 });
    return replies;
  };
  return { send, sent, reads, calls, store, catalog, ai, transcripts, session: () => store.get(PHONE) };
}

export async function simulatePropertyScope() {
  const results = [];
  const run = async (name, action) => {
    const f = scopeFixture();
    try { await action(f); results.push({ name, passed: true, transcript: f.transcripts }); }
    catch (error) { results.push({ name, passed: false, error: error.message, transcript: f.transcripts }); }
  };
  await run('Perkenalan Verlyna dan kembali ke properti setelah urusan lain', async (f) => {
    assert.deepEqual(await f.send('selamat siang'), [INTRODUCTION_MESSAGE]);
    assert.deepEqual(await f.send('saya verlyna'), ['Salam kenal, Verlyna. Ada yang bisa saya bantu?']);
    assert.deepEqual(await f.send('Pak tolong kirim invoice proyek kemarin'), []);
    assert.equal(f.reads.length, 0); assert.equal(f.calls.length, 0);
    assert.ok((await f.send('Pak tolong carikan saya aset property di Surabaya')).length);
    assert.equal(f.session().client_identity.name, 'verlyna');
  });
  for (const text of propertySearchSamples) await run(`Properti: ${text}`, async (f) => {
    await f.send('selamat siang'); await f.send('saya verlyna');
    assert.ok((await f.send(text)).length, 'Permintaan properti harus ditanggapi');
    assert.equal(f.session().is_bot_active, true);
    assert.equal(f.session().client_identity.name, 'verlyna');
  });
  for (const phase of ['awal', 'setelah perkenalan', 'saat membahas aset', 'saat kualifikasi']) {
    for (const text of unrelatedSamples) await run(`${phase}: ${text}`, async (f) => {
      if (phase === 'setelah perkenalan') { await f.send('selamat siang'); await f.send('saya verlyna'); }
      if (phase === 'saat membahas aset') await f.send('Kode 121791');
      if (phase === 'saat kualifikasi') await f.send('Cari rumah lelang di Benowo Surabaya budget 500 juta');
      const reads = f.reads.length, calls = f.calls.length;
      const previous = f.session() && structuredClone({ asset_id: f.session().asset_id, buyer: f.session().buyer_state, identity: f.session().client_identity });
      assert.deepEqual(await f.send(text), [], 'Urusan lain harus diabaikan tanpa balasan');
      assert.equal(f.reads.length, reads, 'Urusan lain tidak boleh membaca katalog');
      assert.equal(f.calls.length, calls, 'Urusan lain tidak boleh membuat jawaban AI');
      assert.equal(f.session().is_bot_active, true, 'Urusan lain tidak boleh menonaktifkan bot');
      if (previous) assert.deepEqual({ asset_id: f.session().asset_id, buyer: f.session().buyer_state, identity: f.session().client_identity }, previous);
      if (phase === 'saat membahas aset') {
        assert.ok((await f.send('brp harganya?')).length);
        assert.equal(f.session().asset_id, '121791');
        assert.ok(f.calls.at(-1).history.every((item) => item.content !== text), 'Pesan yang diabaikan tidak masuk konteks jawaban berikutnya');
      }
    });
  }
  return results;
}
