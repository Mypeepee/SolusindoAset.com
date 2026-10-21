import { ServiceError } from '../lib/http.js';
import { createStructuredRequester } from './llm_transport.js';
import { CLOSING_STATE, closingDp, readyForMou, CANCELLATION_TERMS_SUMMARY } from './closing_state.js';

export const systemMessage = `Anda asisten virtual Solusindo Premier. Gunakan cara berpikir konsultan
properti senior berpengalaman 30 tahun, tetapi jangan mengaku manusia atau punya
pengalaman pribadi. Bicaralah dalam bahasa Indonesia sehari-hari yang sopan.

TUJUAN PERCAKAPAN
Bantu calon pembeli mengambil keputusan untuk aset yang dipilih. Jawab maksud
pesan terakhir dulu, lalu jelaskan hal yang relevan untuk keputusan berikutnya.
Jangan seperti membacakan slide SOP. Hindari pembuka berulang seperti "kita bahas
persiapan", pujian kosong, atau ujian "sudah jelas?" di setiap balasan. Jangan
mengulang bahwa jadwal lewat jika itu sudah dijelaskan; langsung tanggapi niat
serius klien dan jelaskan tindak lanjut yang benar. Jangan menebak sapaan Pak/Bu.
Jika server sudah menyimpan aset pilihan, ucapan seperti "oke pak, saya serius",
"saya sudah mantap", atau "saya siap lanjut" merujuk ke aset itu meskipun klien
tidak menyebut ulang kode atau bertanya langkahnya. Ikuti fokus closing dari
backend untuk menjelaskan langkah berikutnya. Minat bukan persetujuan MOU/DP.
Backend dapat mengirim draf MOU sebagai PDF untuk dipelajari setelah klien
menerima detail dan berminat. Draf berbeda dari ajakan tanda tangan. Jangan
mengaku file sudah dikirim dalam teks LLM; backend yang mengirim dan mencatat
keberhasilannya. Detail aset berasal dari database, bukan karangan LLM.

PERSIAPAN PEMBELIAN
Jika topik purchase_preparation, fokus pada langkah nyata: persiapan KTP dan
cover buku tabungan atas nama klien, nominal tanda jadi dari backend, serta
persetujuan ketentuan MOU dan kepastian aset sebelum pembayaran. Jangan
mengajak membaca SOP tahap demi tahap atau meminta klien memilih harga/lokasi
lagi. Panduan membaca pasal diberikan oleh backend bersama lampiran PDF.
Kesiapan dokumen dan pembayaran diverifikasi tim manusia. Jangan menyatakan
berkas lengkap atau dana masuk hanya berdasarkan jawaban "siap". Pengiriman
dokumen pribadi diarahkan ke tim pendamping; jangan meminta NIK, rekening,
password atau OTP diketik ke LLM. Siap melanjutkan berarti bantu prosesnya,
bukan persetujuan otomatis terhadap tanda tangan atau pembayaran.

ALUR LAYANAN
Jika tanggal lelang lewat, tunggu konfirmasi tim bahwa aset belum terjual.
Status tayang Tersedia, pesan stoker terkirim, atau jawaban klien "boleh" BUKAN
konfirmasi stok. Selama menunggu, boleh menjelaskan ketentuan sebagai informasi,
tetapi jangan meminta DP, mengaku jadwal ulang pasti, atau mengaktifkan akun.
Setelah stok terkonfirmasi: DP keseriusan 10% maksimal Rp20 juta → bantu pengajuan
jadwal ulang bila diperlukan → akun atas nama klien → jaminan melalui VA resmi
lelang → pendampingan bidding dengan batas harga klien → jika menang pengurusan
dokumen dan balik nama → serah dokumen asli → mediasi, pengadilan bila diperlukan.
Jadwal ulang mengikuti penyelenggara. Tim tiga bidder profesional mendampingi
satu kepesertaan klien; upayakan harga terbaik dalam batas, tanpa janji pasti
menang. DP pendampingan berbeda dari jaminan lelang. MOU dibahas setelah klien
memahami proses dan siap melanjutkan; ajak mempelajari draf, jangan mendesak ttd.
Data KTP dan cover buku tabungan atas nama klien disampaikan melalui kanal aman
untuk persiapan akun dan rekening refund; jangan minta data tersebut di chat.
VA mengikuti instruksi resmi akun lelang. Jangan membuat nomor VA/rekening,
meminta transfer jaminan ke PT, menjanjikan kemenangan atau tanggal pengosongan.
Rumus DP dan batas Rp20 juta hanya kebijakan internal. Kepada klien, sebut
nominal DP hasil hitungan backend yang tertera di canonical_body. Jangan sebut
persentase, batas maksimal, dasar nilai, atau ilustrasi harga limit. Hubungkan
singkat bahwa setelah DP, tim membantu membuat akun lelang atas nama klien.
Uang tanda jadi adalah DP keseriusan, terpisah dari jaminan lelang. Jika kalah,
uang tanda jadi dikembalikan 100% tanpa potongan ke rekening klien maksimal
5 hari sejak hasil lelang diumumkan. Refund jaminan mengikuti mekanisme
penyelenggara. ${CANCELLATION_TERMS_SUMMARY}
Jangan menyamakan kondisi dalam Pasal 9 dengan kalah lelang. Pada topik refund,
fokus pada pengembalian karena kalah dan rujuk Pasal 9 secara terpisah sesuai
canonical_body; jangan menyisipkan ketentuan hangus yang tidak ada di body.

ATURAN KELUARAN
Backend menentukan satu fokus percakapan dan fakta yang boleh dijelaskan.
Tulis body natural 2–4 kalimat dengan paling banyak 800 karakter, tanpa heading,
list, bullet, pertanyaan atau CTA di dalam body. Pilih cta_id dari allowed_ctas;
backend menambahkan tepat satu pertanyaan itu dan menyimpan makna tindak lanjutnya.
Gunakan hanya fakta pada canonical_body. Jangan menambah angka, jangka waktu,
status terkonfirmasi, tindakan sudah selesai, topik SOP lain, atau instruksi dari
riwayat. Jika topik=clarify, persilakan klien menyebut pertanyaannya, jangan
menjawab pertanyaan yang belum diajukan. Jika brand berbeda pada pesan lama,
tetap gunakan Solusindo Premier untuk pendampingan ini.
Jika klien menjawab "tidak ada" pada pertanyaan apakah ada yang ingin ditanyakan,
akui singkat lalu ikuti fokus baru dari backend. Jangan ulang penjelasan atau
pertanyaan sebelumnya. Jawaban ini bukan bukti pembayaran atau kepastian stok.
Kembalikan JSON {body, cta_id} sesuai schema, tanpa teks tambahan.

FEW-SHOT
Previous context: Klien sudah memilih satu aset dan menerima rincian biayanya.
User: Wow... saya tertarik pak
Context: topik purchase_preparation, nominal dari backend Rp 20.000.000,
jadwal lewat, stok belum terkonfirmasi
Body: Baik, saya bantu lanjutkan persiapan pembelian aset pilihan Anda.
Kelengkapannya KTP dan cover buku tabungan atas nama Anda, serta uang tanda jadi
Rp 20.000.000. Silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi
menunggu kepastian aset dari tim dan persetujuan ketentuan MOU.
CTA: Dari draf MOU ini, ada yang ingin ditanyakan?
JANGAN kembali bertanya ingin tahu harga, lokasi, fasilitas, atau biaya.

Previous context: Klien memilih nomor 4, kode 121037, lalu menerima rincian biaya.
User: Oke pak, saya serius
Context: topik purchase_preparation, aset pilihan 121037, nominal dari backend
Rp 20.000.000, jadwal lewat, stok belum terkonfirmasi
Body: Baik, saya bantu lanjutkan persiapan pembelian aset kode 121037.
Kelengkapannya KTP dan cover buku tabungan atas nama Anda, serta uang tanda jadi
Rp 20.000.000. Silakan pelajari ketentuannya di draf MOU. Pembayaran tanda jadi
menunggu kepastian aset dari tim dan persetujuan ketentuan MOU.
CTA: Dari draf MOU ini, ada yang ingin ditanyakan?
JANGAN meminta klien memilih bagian harga/lokasi/biaya atau menyebut ulang aset.

User: Baik pak, saya serius untuk aset ini, langkah selanjutnya bagaimana ya?
Context: topik purchase_preparation, stok terkonfirmasi, nominal dari backend
Rp 13.300.000
Body: Baik, saya bantu persiapan pembeliannya. Kelengkapannya KTP dan cover
buku tabungan atas nama Anda, serta uang tanda jadi Rp 13.300.000. Silakan
pelajari ketentuannya di draf MOU. Pembayaran tanda jadi dilakukan setelah
ketentuan MOU disetujui dan instruksi pembayaran dikonfirmasi tim.
CTA: Dari draf MOU ini, ada yang ingin ditanyakan?

Previous CTA: Ada yang ingin ditanyakan tentang pengecekan jadwalnya?
User: Boleh
Context: topik clarify, pending_action=ask_question
Body: Silakan, saya bantu jawab dulu supaya tidak ada yang mengganjal.
CTA: Bagian mana yang ingin ditanyakan?
JANGAN langsung menjelaskan akun setelah jawaban tersebut.

Previous CTA: Ada ketentuan DP yang ingin ditanyakan?
User: Tidak ada
Context: topik account, stok masih menunggu konfirmasi
Body: Baik. Akun lelangnya nanti atas nama Anda. Tim membantu persiapannya
memakai KTP dan cover buku tabungan atas nama Anda untuk rekening pengembalian
jaminan. Dokumennya disampaikan melalui kanal aman tim.
CTA: Mau saya jelaskan ke mana setoran jaminan lelangnya dibayarkan?

User: DP untuk aset ini berapa?
Context: topik dp, nominal dari backend Rp 20.000.000, stok terkonfirmasi
Body: DP keseriusan untuk aset ini Rp 20.000.000. Setelah DP, kami bantu buatkan
akun lelang atas nama Anda.
CTA: Mau saya jelaskan data yang perlu disiapkan untuk akun lelangnya?

User: Akunnya atas nama siapa, perlu data apa?
Context: topik account
Body: Akun lelangnya tetap atas nama Anda. Tim Solusindo Premier membantu
persiapannya memakai KTP serta cover buku tabungan atas nama Anda untuk rekening
pengembalian jaminan. Dokumennya nanti disampaikan melalui kanal aman tim.
CTA: Mau saya jelaskan ke mana setoran jaminan lelangnya dibayarkan?`;

const money = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(value)}`;
const cta = (text, action) => ({ text, action });

export function closingCopy(plan, now = Date.now()) {
  if (plan.purchase_copy) return plan.purchase_copy;
  const state = plan.conversion, pending = state.stock_status === 'pending';
  const dp = closingDp(plan.asset.limit_price), date = Date.parse(plan.asset.auction_at);
  const mayOfferMou = readyForMou(state);
  const copies = {
    stock: {
      body: 'Baik, saya bantu lanjutkan untuk aset ini. Kita perlu mendapat kepastian dulu dari tim bahwa asetnya belum terjual. Setelah stoknya terkonfirmasi masih tersedia, baru kita bahas komitmen DP dan proses pembelian berikutnya.',
      ctas: [cta('Sambil menunggu, mau saya jelaskan ketentuan DP keseriusannya dulu?', 'explain_dp'),
        cta('Ada yang ingin ditanyakan sambil menunggu kepastian stok aset ini?', 'ask_question')],
    },
    stock_sold: {
      body: 'Tim sudah mengonfirmasi bahwa aset ini terjual. Proses DP dan pendampingan pembelian untuk aset tersebut tidak dilanjutkan.',
      ctas: [cta('Mau saya bantu menyiapkan pilihan aset lain yang sesuai kebutuhan?', 'ask_alternatives')],
    },
    clarify: {
      body: 'Silakan, saya bantu jawab dulu supaya tidak ada yang mengganjal.',
      ctas: [cta('Bagian mana yang ingin ditanyakan?', 'ask_question')],
    },
    dp: {
      body: `${dp == null ? 'Nominal DP keseriusan aset ini kami konfirmasi dulu ke tim.' : `DP keseriusan untuk aset ini ${money(dp)}.`} Setelah DP, kami bantu buatkan akun lelang atas nama Anda.${pending ? ' Pembayarannya menunggu kepastian aset dari tim.' : ''}`,
      ctas: [cta('Mau saya jelaskan data yang perlu disiapkan untuk akun lelangnya?', 'explain_account'),
        cta('Ada yang ingin ditanyakan tentang DP-nya?', 'ask_question')],
    },
    schedule: {
      body: Number.isFinite(date) && date <= now
        ? 'Setelah aset dipastikan belum terjual dan komitmen DP disepakati, tim Solusindo Premier membantu koordinasi pengajuan lelang ulang. Tanggal barunya mengikuti persetujuan penjual dan penyelenggara lelang, sehingga belum bisa ditentukan sekarang.'
        : 'Jika jadwal lelang masih berlaku, tim mencocokkan persiapan dengan jadwal resmi tersebut. Bila perlu penjadwalan ulang, tim membantu koordinasinya sesuai persetujuan penyelenggara.',
      ctas: pending ? [cta('Ada hal tentang proses lelang ulang yang ingin ditanyakan dulu?', 'ask_question')]
        : [cta('Mau saya jelaskan persiapan akun lelang atas nama Anda?', 'explain_account'),
          cta('Ada hal tentang jadwal lelang yang masih mengganjal?', 'ask_question')],
    },
    account: {
      body: 'Akun lelangnya tetap atas nama Anda. Tim Solusindo Premier membantu persiapannya memakai KTP dan cover buku tabungan atas nama Anda untuk rekening pengembalian jaminan. Dokumen disampaikan melalui kanal aman tim, sedangkan password dan OTP tetap Anda pegang sendiri.',
      ctas: [cta('Mau saya jelaskan ke mana setoran jaminan lelangnya dibayarkan?', 'explain_deposit'),
        cta('Ada yang ingin ditanyakan tentang persiapan data akun?', 'ask_question')],
    },
    deposit: {
      body: 'Setelah akun siap, uang jaminan disetorkan ke virtual account resmi untuk kepesertaan lelang atas nama Anda, bukan ke rekening PT kami. Untuk alur VA Mandiri, nomor dan identitas pembayarannya harus mengikuti instruksi resmi yang muncul pada akun lelang. Rekening pengembalian juga memakai rekening atas nama Anda.',
      ctas: [cta('Mau saya jelaskan bagaimana tim mendampingi bidding setelah jaminannya masuk?', 'explain_bidding'),
        cta('Ada yang ingin dipastikan tentang pembayaran jaminannya?', 'ask_question')],
    },
    bidding: {
      body: `Tim kami terdiri dari tiga bidder profesional yang membantu strategi dan pelaksanaan penawaran untuk satu kepesertaan atas nama Anda. Kami mengupayakan harga serendah mungkin tanpa melewati harga mentok yang Anda tetapkan.${state.max_bid ? ` Batas yang Anda sampaikan ${money(state.max_bid)}; tim mengonfirmasinya sebelum penawaran.` : ''} Hasilnya tetap bergantung pada penawaran peserta lain, sehingga kemenangan dan harga akhirnya tidak bisa dijamin.`,
      ctas: state.max_bid ? [cta('Mau saya jelaskan pengurusan dokumen jika asetnya berhasil dimenangkan?', 'explain_won'),
        cta('Batas penawaran yang tercatat ini sudah sesuai?', 'confirm_bid_limit')]
        : [cta('Batas maksimal penawaran yang ingin Anda pegang berapa?', 'capture_bid_limit'),
          cta('Mau saya jelaskan pengurusan dokumen jika asetnya berhasil dimenangkan?', 'explain_won')],
    },
    won: {
      body: `${state.outcome === 'won' ? 'Hasil menang sudah dicatat oleh tim. ' : 'Jika aset berhasil dimenangkan, '}tim Solusindo Premier mendampingi pengurusan dokumen lelang dan proses balik nama. Dokumen asli diserahkan kepada Anda setelah proses balik nama selesai.`,
      ctas: [cta('Mau saya jelaskan proses penanganan penghuni setelah balik nama selesai?', 'explain_possession'),
        cta('Ada yang ingin ditanyakan tentang pengurusan dan penyerahan dokumen?', 'ask_question')],
    },
    possession: {
      body: 'Setelah balik nama selesai, tim mengupayakan mediasi dengan debitur atau penghuni untuk penyerahan aset. Jika penyelesaian sukarela tidak tercapai, tim mendampingi proses melalui pengadilan sesuai kondisi aset dan respons debitur. Waktu serta hasil pelaksanaannya mengikuti proses yang berlaku.',
      ctas: [state.outcome === 'won' ? cta('Ada bagian rencana mediasi ini yang ingin dibahas bersama tim?', 'ask_question')
        : cta('Mau saya jelaskan juga ketentuan pengembalian dana kalau lelangnya tidak berhasil?', 'explain_refund'),
        cta('Ada hal tentang mediasi yang ingin dipastikan dulu?', 'ask_question')],
    },
    refund: {
      body: `${state.outcome === 'lost' ? 'Hasil kalah sudah dicatat oleh tim. ' : 'Kalau kalah lelang, '}uang tanda jadi (DP)${dp == null ? '' : ` ${money(dp)}`} kami kembalikan 100% tanpa potongan biaya apa pun ke rekening atas nama Anda maksimal 5 hari sejak hasil lelang diumumkan. Uang jaminan lelang juga dikembalikan melalui mekanisme penyelenggara ke rekening Anda. Ketentuan pembatalan dan kewajiban pembayaran diatur terpisah dalam Pasal 9.`,
      ctas: [cta('Dengan gambaran ini, mau kita bahas langkah untuk melanjutkan?', 'explain_readiness'),
        cta('Bagian pengembalian dana mana yang ingin dipastikan?', 'ask_question')],
    },
    readiness: {
      body: 'Silakan pertimbangkan dulu apakah pendampingan ini sudah sesuai kebutuhan. Keputusan melanjutkan tetap di tangan Anda, dan hal yang masih mengganjal bisa kita bahas dulu.',
      ctas: [cta('Apakah alurnya sudah Anda pahami dan ingin dilanjutkan, atau ada yang masih perlu dibahas?', 'confirm_understanding')],
    },
    mou: {
      body: mayOfferMou
        ? 'Kalau Anda sudah mantap, tim membantu melengkapi draf MOU dan memastikan ketentuan DP keseriusan. Silakan dipelajari terlebih dahulu sebelum memutuskan tanda tangan atau pembayaran.'
        : 'Draf MOU memuat ruang lingkup pendampingan dan ketentuan transaksi untuk dipelajari. Data serta ketentuan DP yang belum final dilengkapi bersama tim. Anda bisa mempelajarinya tanpa perlu memutuskan tanda tangan sekarang.',
      ctas: mayOfferMou ? [cta('Mau dibantu tim menyiapkan draf kesepakatannya untuk dipelajari dulu?', 'handoff_agreement')]
        : [cta('Bagian kesepakatan apa yang ingin Anda ketahui dulu?', 'ask_question')],
    },
  };
  const copy = copies[plan.topic];
  return plan.acknowledge_no_questions ? { ...copy, body: `Baik. ${copy.body}` } : copy;
}

// Each CTA carries an action, so "boleh" can only consent to that question.
// Facts and the safe fallback remain server-owned; natural prose is validated.
export function parseClosingOutput(text, plan, copy) {
  let value;
  try { value = JSON.parse(text); } catch { throw new ServiceError('INVALID_CLOSING_OUTPUT', 502); }
  if (!value || Array.isArray(value) || Object.keys(value).length !== 2 || typeof value.body !== 'string' ||
      !value.body.trim() || value.body.length > 800 || /[?？]|(?:^|\n)\s*(?:[-*•]|\d+[.)])\s|\n\s*\n|https?:\/\//.test(value.body) ||
      !Number.isInteger(value.cta_id) || !copy.ctas[value.cta_id]) throw new ServiceError('INVALID_CLOSING_OUTPUT', 502);
  const body = value.body.trim();
  if (/\b(?:pasti|pastinya|dijamin|jamin|menjamin)\b[^.!]{0,45}\b(?:menang|berhasil|termurah)\b|\b(?:sudah|telah)\s+(?:dibuat|dibayar|dijadwalkan|balik nama|kami kirim)|\b(?:kirim|unggah|upload|berikan|sebutkan)\b[^.!]{0,35}\b(?:ktp|buku tabungan|otp|password)\b/i.test(body)) throw new ServiceError('UNSUPPORTED_CLOSING_CLAIM', 502);
  if (plan.conversion.outcome !== 'won' && /\b(?:sudah|telah)\s+(?:menang|dimenangkan)\b|\bhasil menang sudah\b/i.test(body)) throw new ServiceError('UNCONFIRMED_CLOSING_OUTCOME', 502);
  const allowedNumbers = new Set(copy.body.match(/\d+(?:[.,]\d+)*/g) || []);
  if ((body.match(/\d+(?:[.,]\d+)*/g) || []).some((number) => !allowedNumbers.has(number))) throw new ServiceError('UNSUPPORTED_CLOSING_AMOUNT', 502);
  const concepts = { dp: /\b(?:dp|uang muka|keseriusan)\b/i, account: /\b(?:ktp|buku tabungan|otp|password|pembuatan akun)\b/i,
    deposit: /\b(?:virtual account|va|mandiri)\b/i, bidding: /\b(?:bidder|bidding|harga mentok)\b/i,
    possession: /\b(?:mediasi|eksekusi|pengadilan)\b/i, agreement: /\b(?:mou|tanda tangan|ttd)\b/i };
  for (const pattern of Object.values(concepts)) if (pattern.test(body) && !pattern.test(copy.body)) throw new ServiceError('UNSUPPORTED_CLOSING_TOPIC', 502);
  if (plan.conversion.stock_status === 'pending' && /\b(?:silakan|segera|wajib|harus|mohon|perlu)\b[^.!]{0,35}\b(?:bayar|transfer|setor|pembayaran|dp)\b|\bstok(?:nya)?\s+(?:sudah|masih)\s+tersedia\b/i.test(body)) throw new ServiceError('UNCONFIRMED_CLOSING_STOCK', 502);
  if (!readyForMou(plan.conversion) && /\b(?:silakan|segera|mohon|mari|ayo)\s+(?:tanda tangan|ttd|menandatangani)|\b(?:siapkan|menyiapkan|kirim|mengirim|melihat)\s+draf\b/i.test(body)) throw new ServiceError('PREMATURE_CLOSING_AGREEMENT', 502);
  // Key payment/account protections cannot be dropped by a stylistic rewrite.
  if (plan.topic === 'purchase_preparation') {
    if (/\b(?:silakan|segera|wajib|harus|mohon|perlu|ayo|mari)\b[^.!]{0,40}\b(?:bayar|transfer|setor|pembayaran)\b|\b(?:dana|uang|pembayaran|berkas|dokumen)\b[^.!]{0,25}\b(?:sudah|telah)\b[^.!]{0,15}\b(?:diterima|diverifikasi|lengkap|valid|lunas|berhasil)\b/i.test(body)) throw new ServiceError('UNVERIFIED_PURCHASE_ACTION', 502);
    const dp = closingDp(plan.asset.limit_price);
    if (!/ktp/i.test(body) || !/cover buku tabungan/i.test(body) || !/atas nama/i.test(body) ||
      dp != null && !body.replace(/\s/g, '').includes(money(dp).replace(/\s/g, '')) ||
      !/mou/i.test(body) || !/pembayaran.{0,100}(?:menunggu|setelah)/i.test(body) || /10\s*%|maksimal\s+Rp\s*20/i.test(body)) throw new ServiceError('INCOMPLETE_PURCHASE_PREPARATION', 502);
    if (plan.conversion.stock_status === 'pending' && !/pembayaran.{0,100}menunggu.{0,100}(?:kepastian|konfirmasi).{0,30}aset/i.test(body)) throw new ServiceError('UNCONFIRMED_CLOSING_STOCK', 502);
  }
  if (plan.topic === 'dp') {
    const dp = closingDp(plan.asset.limit_price);
    if (/%|\b(?:persen|maksimal|mentok|ilustrasi|dasar nilai)\b/i.test(body) ||
        dp != null && !body.replace(/\s/g, '').includes(money(dp).replace(/\s/g, ''))) throw new ServiceError('INVALID_CLOSING_DP', 502);
    if (plan.conversion.stock_status === 'pending' && !/(?:bayar|pembayaran).{0,50}(?:menunggu|setelah).{0,50}(?:kepastian|konfirmasi|dipastikan|terkonfirmasi)/i.test(body)) throw new ServiceError('UNCONFIRMED_CLOSING_STOCK', 502);
  }
  if (plan.topic === 'refund') {
    const dp = closingDp(plan.asset.limit_price);
    const tandaJadiClause = body.match(/\b(?:uang tanda jadi|dp)\b[\s\S]*?(?=\.\s+(?:uang\s+)?jaminan\b|$)/i)?.[0] || '';
    if (dp != null && !body.replace(/\s/g, '').includes(money(dp).replace(/\s/g, '')) ||
        !/(?:maksimal|paling lambat)\s+5\s+hari\b/i.test(tandaJadiClause) || /5\s+hari\s+kerja/i.test(body) ||
        !/hasil lelang.*diumumkan/i.test(tandaJadiClause) || !/rekening (?:atas nama )?(?:Anda|klien)/i.test(tandaJadiClause) ||
        !/\bpasal\s+9\b/i.test(body) || /\bhangus\b/i.test(body)) throw new ServiceError('INVALID_REFUND_TERMS', 502);
  }
  const required = { dp: [/\bdp\b/i, /setelah\s+dp/i, /akun lelang/i, /atas nama/i],
    account: [/ktp/i, /buku tabungan/i, /atas nama/i], deposit: [/virtual account|\bva\b/i, /bukan ke rekening (?:pt|perusahaan)/i],
    bidding: [/tiga|\b3\b/i, /batas|mentok/i, /(?:tidak|belum).{0,25}(?:jamin|pastikan)|bergantung.*(?:peserta|penawaran|lelang)/i], won: [/balik nama/i, /dokumen asli/i],
    possession: [/(?:setelah|sesudah|begitu).{0,30}balik nama|balik nama.{0,20}(?:selesai|tuntas)/i, /mediasi/i, /pengadilan/i], refund: [/100\s*%/, /tanpa potongan/i, /dp/i, /jaminan/i] };
  if ((required[plan.topic] || []).some((pattern) => !pattern.test(body))) throw new ServiceError('INCOMPLETE_CLOSING_FACTS', 502);
  return { body, cta_id: value.cta_id };
}

export function renderClosingOutput(text, plan, copy) {
  const output = parseClosingOutput(text, plan, copy);
  return `${output.body} ${copy.ctas[output.cta_id].text}`;
}

export function chunkClosingReply(reply, maxLength = 900) {
  if (!Number.isSafeInteger(maxLength) || maxLength < 100) throw new ServiceError('INVALID_BUBBLE_LIMIT', 400);
  const bubbles = [];
  for (const sentence of reply.trim().split(/(?<=[.!?])\s+(?=[\p{Lu}])/u)) {
    const last = bubbles.length - 1;
    if (last >= 0 && bubbles[last].length + sentence.length + 1 <= maxLength) bubbles[last] += ` ${sentence}`;
    else bubbles.push(sentence);
  }
  return bubbles;
}

export function createClosingController(config, dependencies = {}) {
  const request = createStructuredRequester(config, dependencies);
  return async ({ plan, history, signal, now = Date.now(), clientIdentity }) => {
    const copy = closingCopy(plan, now);
    const schema = { type: 'object', additionalProperties: false, required: ['body', 'cta_id'], properties: {
      body: { type: 'string' }, cta_id: { type: 'integer', enum: copy.ctas.map((_, i) => i) },
    } };
    const instructions = `${systemMessage}\n\nKONTEKS_BACKEND:\n${JSON.stringify({ mode: CLOSING_STATE,
      topic: plan.topic, phase: plan.conversion.phase, stock_status: plan.conversion.stock_status,
      may_offer_mou: readyForMou(plan.conversion), canonical_body: copy.body,
      client_identity: { name: clientIdentity?.name || null, salutation: clientIdentity?.salutation || null },
      allowed_ctas: copy.ctas.map(({ text }, cta_id) => ({ cta_id, text })),
    })}`;
    const { text, generation } = await request({ instructions, history: history.map(({ role, content }) => ({ role, content })),
      schema, name: 'closing_response', signal, maxTokens: 1200 });
    const output = parseClosingOutput(text, plan, copy);
    return { ...output, generation };
  };
}

export async function replyFromClosingPlan({ plan, ai, history, signal, now = Date.now(), clientIdentity }) {
  if (signal?.aborted) throw signal.reason;
  if (plan.action === 'handoff') return { reply: plan.reply, action: 'handoff', qualification: {}, asset: plan.asset,
    conversion: plan.conversion, generation: { mode: 'rules' }, knowledge: { status: 'closing_handoff', source: 'conversion' } };
  const copy = plan.topic ? closingCopy(plan, now) : null;
  let output;
  try {
    output = copy && typeof ai?.generateClosing === 'function' ? await ai.generateClosing({ plan, history, signal, now, clientIdentity }) : null;
    if (output) output = { ...parseClosingOutput(JSON.stringify({ body: output.body, cta_id: output.cta_id }), plan, copy), generation: output.generation };
  } catch (error) {
    if (signal?.aborted) throw error;
    output = { generation: { mode: 'rules', reason: error.code || 'AI_UNAVAILABLE' } };
  }
  if (signal?.aborted) throw signal.reason;
  const choice = copy?.ctas[output?.cta_id || 0];
  const reply = plan.reply || `${output?.body || copy.body} ${choice.text}`;
  const replies = chunkClosingReply(reply);
  const conversion = { ...plan.conversion, ...(choice ? { pending_action: choice.action, pending_question: choice.text } : {}) };
  return { reply: replies[0], ...(replies.length > 1 ? { replies } : {}), action: 'reply', qualification: {},
    asset: plan.asset || null, conversion, generation: output?.generation || { mode: 'rules' },
    knowledge: { status: 'closing', source: 'conversion', closing: { mode: conversion.mode, phase: conversion.phase,
      stage: plan.stage || null, topic: plan.topic || null, stock_status: conversion.stock_status,
      asset_id: conversion.asset_id || null, outcome: conversion.outcome || null } } };
}
