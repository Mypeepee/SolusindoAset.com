// scripts/migrate-properties.js
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:01082003Jason@127.0.0.1:5432/kosku?schema=public';

function mapKategori(tipe) {
  if (!tipe) return 'RUMAH';
  const t = tipe.toLowerCase();
  if (t.includes('apart')) return 'APARTEMEN';
  if (t.includes('ruko')) return 'RUKO';
  if (t.includes('tanah') || t.includes('land')) return 'TANAH';
  if (t.includes('gudang') || t.includes('warehouse')) return 'GUDANG';
  if (t.includes('hotel') || t.includes('villa')) return 'HOTEL_DAN_VILLA';
  if (t.includes('toko') || t.includes('shop')) return 'TOKO';
  if (t.includes('pabrik') || t.includes('factory')) return 'PABRIK';
  if (t.includes('rumah') || t.includes('house')) return 'RUMAH';
  return 'RUMAH';
}

function generateSlugFromAlamat(kategori, alamat, kota, idListing) {
  const cat = (kategori || 'lainnya').toLowerCase();

  let baseAlamat = (alamat || '').toLowerCase();
  baseAlamat = baseAlamat.replace(/\(.*?\)/g, ' ');
  baseAlamat = baseAlamat.replace(/[.,]/g, ' ');
  baseAlamat = baseAlamat.replace(
    /\b(kelurahan|kel\.?|kecamatan|kec\.?|kabupaten|kab\.?|desa|ds\.?|provinsi|propinsi|jl\.?|jalan|no\.?|blok|cluster|perumahan)\b/gi,
    ' ',
  );
  baseAlamat = baseAlamat.replace(/[^a-z0-9\s-]/g, ' ');
  baseAlamat = baseAlamat.replace(/\s+/g, ' ').trim();
  const words = baseAlamat.split(' ').filter(Boolean);
  const selectedWords = words.slice(0, 6);
  let alamatSlug = selectedWords.join('-');

  let city = (kota || '').toLowerCase().trim();
  city = city.replace(/^(kota|kab\.?|kabupaten)\s+/i, '');
  city = city.replace(/[^a-z0-9\s-]/g, ' ');
  city = city.replace(/\s+/g, '-');
  city = city.replace(/-+/g, '-');

  let base = cat;
  if (alamatSlug) base += `-${alamatSlug}`;
  if (city) base += `-${city}`;

  const MAX_BASE_LENGTH = 80;
  if (base.length > MAX_BASE_LENGTH) {
    base = base.slice(0, MAX_BASE_LENGTH);
    base = base.replace(/-+$/g, '');
  }

  return `${base}-${idListing}`;
}

function revertHarga(hargaNaik) {
  if (hargaNaik == null) return 0;
  const h = Number(hargaNaik);
  if (Number.isNaN(h)) return 0;
  return Math.round((h / 1.278) * 100) / 100;
}

function revertJaminan(jaminanNaik) {
  if (jaminanNaik == null) return null;
  const j = Number(jaminanNaik);
  if (Number.isNaN(j)) return null;
  return Math.round((j / 1.2) * 100) / 100;
}

// Valid sertifikat_enum: SHM, HGB, HGU, HP, STRATA_TITLE, PPJB, AJB, LAINNYA
function parseSertifikat(sertifikat) {
  if (!sertifikat) return { legalitas: null, nomor: null };
  const s = sertifikat.trim();
  if (!s || s === '-') return { legalitas: null, nomor: null };

  // --- 1. Deteksi jenis legalitas ---
  // Urutan penting: varian spesifik dulu, baru yang umum
  const typeMap = [
    // SHM — semua varian
    { pattern: /\bSHMSRS\b|\bSHMASRS\b|\bSHMRS\b|\bSHMARS\b/i,  value: 'SHM' }, // SHM Sarusun
    { pattern: /\bSHM-E\b|\bE-SHM\b|\bSHMeL\b/i,                 value: 'SHM' }, // SHM Elektronik
    { pattern: /\bSMH\b/i,                                         value: 'SHM' }, // typo SHM
    { pattern: /\bSHM\b/i,                                         value: 'SHM' },
    { pattern: /\bHak\s+Milik\b/i,                                 value: 'SHM' }, // "Hak Milik Elektronik", dst
    { pattern: /\bBuku\s+Tanah\b/i,                                value: 'SHM' }, // "Buku Tanah Hak Milik"
    { pattern: /\bHM\b/,                                           value: 'SHM' }, // singkatan Hak Milik
    { pattern: /Sertifikat\s+Analog\b/i,                           value: 'SHM' }, // sertifikat analog → SHM
    // HGB — semua varian
    { pattern: /\bSHGB\b/i,                                        value: 'HGB' }, // Sertipikat HGB
    { pattern: /\bSHBG\b/i,                                        value: 'HGB' }, // typo SHGB
    { pattern: /\bHak\s+Guna\s+Bangunan\b/i,                       value: 'HGB' }, // "HAK GUNA BANGUNAN ELEKTRONIK"
    { pattern: /\bHGB\b/i,                                         value: 'HGB' },
    // HGU
    { pattern: /\bSHGU\b/i,                                        value: 'HGU' }, // Sertipikat HGU
    { pattern: /\bHak\s+Guna\s+Usaha\b/i,                          value: 'HGU' },
    { pattern: /\bHGU\b/i,                                         value: 'HGU' },
    // HP
    { pattern: /\bSHP\b/i,                                         value: 'HP'  }, // Sertipikat Hak Pakai
    { pattern: /\bHPL\b/i,                                         value: 'HP'  }, // Hak Pengelolaan Lahan
    { pattern: /\bHak\s+Pakai\b/i,                                 value: 'HP'  },
    // Strata Title
    { pattern: /\bstrata\s*title\b/i,                              value: 'STRATA_TITLE' },
    // AJB
    { pattern: /\bAkta\s+Jual[\s-]+Beli\b/i,                       value: 'AJB' }, // "Akta Jual Beli", "Akta Jual - Beli"
    { pattern: /\bAJB\b/i,                                         value: 'AJB' },
    // PPJB
    { pattern: /\bPPJB\b/i,                                        value: 'PPJB' },
    // Sertifikat Elektronik + Hak Milik → SHM (muncul sebelum fallback generic)
    { pattern: /Sertifikat\s+Elektronik\s+Hak\s+Milik/i,           value: 'SHM' },
    { pattern: /Sertifikat\s+Elektronik\s+Hak\s+Guna\s+Bangunan/i, value: 'HGB' },
    { pattern: /Sertifikat\s+Elektronik\s+SHGB/i,                  value: 'HGB' },
    // Sertifikat/Sertipikat + Hak Milik (termasuk typo Sertfikat)
    { pattern: /Sert[ifikat]*\s+Hak\s+Milik/i,                     value: 'SHM' },
  ];

  let legalitas = null;
  for (const { pattern, value } of typeMap) {
    if (pattern.test(s)) {
      legalitas = value;
      break;
    }
  }
  if (!legalitas) legalitas = 'LAINNYA';

  // --- 2. Ekstrak nomor sertifikat ---
  // Format umum: "TYPE [No./NO/Nomor] CERT_NUM [No:] NIB | tanggal"
  // Strategi:
  //   A. Cari nomor di bagian SEBELUM "No:" (cert section) → nomor sertifikat asli
  //   B. Jika tidak ada, cari di bagian SESUDAH "No:" → mungkin saja hanya ada NIB
  //   C. Jika tidak ada keyword sama sekali, cari angka langsung setelah TYPE

  // Buang bagian tanggal setelah " | "
  const pipeIdx = s.indexOf(' | ');
  const main = pipeIdx >= 0 ? s.slice(0, pipeIdx) : s;

  // Pisah certSection dan nibSection pada "No:"
  const noColonIdx = main.search(/No:/i);
  const certSection = noColonIdx >= 0 ? main.slice(0, noColonIdx) : main;
  const nibSection  = noColonIdx >= 0 ? main.slice(noColonIdx)    : '';

  let nomor = null;

  // A) Angka setelah "No." / "No " / "Nomor" / "nomor" di certSection
  //    Contoh: "SHM NO.21028", "SHM No. 1051/Kel.", "SHM No 473", "SHM Nomor 00100"
  const certKeywordMatch = certSection.match(/(?:No[.\s]+|Nomor\s+)([0-9]+)/i);
  if (certKeywordMatch) {
    nomor = certKeywordMatch[1];
  }

  // B) Angka langsung setelah keyword TYPE (tanpa "No."), misal "SHM 01124", "AJB 71/2011"
  if (!nomor) {
    const directMatch = certSection.match(
      /(?:SHMSRS|SHMASRS|SHMRS|SHMARS|SHM-E|E-SHM|SHMeL|SMH|SHGU|SHGB|SHBG|SHM|HGB|HGU|SHP|HPL|AJB|PPJB|HM)\s+([0-9]+)/i,
    );
    if (directMatch) nomor = directMatch[1];
  }

  // C) Fallback: cari di nibSection
  //    Handles: "No: 00152", "No: No. 7966", "No: SHGB NO.157", "No: N0 : 253", "No: NO. 02867"
  if (!nomor && nibSection) {
    const nibMatch = nibSection.match(
      /No:\s*(?:[A-Z-]+\s+)?(?:N[o0][.:\s]+)?([0-9]+)/i,
    );
    if (nibMatch) nomor = nibMatch[1];
  }

  return { legalitas, nomor: nomor || null };
}

async function migrateProperties() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL (properties)');

  try {
    const { rows } = await client.query(`
      SELECT *
      FROM public.property_tampungan
      WHERE id_agent IS NOT NULL
      ORDER BY id_listing
    `);

    console.log('Total property_tampungan ditemukan:', rows.length);

    let inserted = 0;
    let updated = 0;
    let skippedNoAgent = 0;
    let fail = 0;

    for (const prop of rows) {
      const {
        id_listing,
        id_agent,
        vendor,
        judul,
        deskripsi,
        tipe,
        harga,
        lokasi,
        luas,
        provinsi,
        kota,
        kecamatan,
        kelurahan,
        sertifikat,
        status,
        gambar,
        uang_jaminan,
        batas_akhir_penawaran,
        tanggal_dibuat,
        tanggal_diupdate,
        link,
      } = prop;

      try {
        const mapRes = await client.query(
          `SELECT id_agent_baru FROM public.mapping_agent WHERE id_agent_lama = $1`,
          [id_agent],
        );

        if (mapRes.rowCount === 0) {
          skippedNoAgent++;
          console.warn(
            `SKIP (agent tidak ditemukan): property ${id_listing}, agent ${id_agent}`,
          );
          continue;
        }

        const idAgentBaru = mapRes.rows[0].id_agent_baru;

        const kategori = mapKategori(tipe);
        const hargaLimitAsli = revertHarga(harga);
        const jaminanAsli = revertJaminan(uang_jaminan);
        const judulFinal = judul && judul.trim().length > 0 ? judul : `Listing ${id_listing}`;
        const kotaFinal = kota && kota.trim().length > 0 ? kota : 'KOTA TIDAK DIKETAHUI';
        const slug = generateSlugFromAlamat(kategori, lokasi || '', kotaFinal, id_listing);

        const { legalitas, nomor: nomorLegalitas } = parseSertifikat(sertifikat);

        const luasNum = luas ? Number(luas) : null;
        const hargaPerMeter =
          luasNum && luasNum > 0
            ? Math.round((hargaLimitAsli / luasNum) * 100) / 100
            : null;

        const result = await client.query(
          `
          INSERT INTO public.listing (
            id_agent,
            judul,
            slug,
            deskripsi,
            jenis_transaksi,
            kategori,
            vendor,
            status_tayang,
            harga,
            harga_promo,
            tanggal_lelang,
            uang_jaminan,
            nilai_limit_lelang,
            link,
            alamat_lengkap,
            provinsi,
            kota,
            kecamatan,
            kelurahan,
            luas_tanah,
            legalitas,
            nomor_legalitas,
            gambar,
            harga_per_meter,
            tanggal_dibuat,
            tanggal_diupdate
          )
          VALUES (
            $1, $2, $3, $4,
            'LELANG'::jenis_transaksi_enum,
            $5::kategori_properti_enum,
            $6,
            CASE WHEN UPPER(TRIM(COALESCE($7, ''))) = 'TERJUAL'
              THEN 'TERJUAL'::status_properti_enum
              ELSE 'TERSEDIA'::status_properti_enum
            END,
            $8,
            NULL,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19::sertifikat_enum,
            $20,
            $21,
            $22,
            $23,
            $24
          )
          ON CONFLICT (slug) DO UPDATE SET
            link            = COALESCE(listing.link, EXCLUDED.link),
            legalitas       = CASE
              WHEN listing.legalitas IS NULL OR listing.legalitas = 'LAINNYA'
              THEN EXCLUDED.legalitas
              ELSE listing.legalitas
            END,
            nomor_legalitas = COALESCE(listing.nomor_legalitas, EXCLUDED.nomor_legalitas),
            harga_per_meter = COALESCE(listing.harga_per_meter, EXCLUDED.harga_per_meter)
          RETURNING id_property, (xmax = 0) AS is_insert
        `,
          [
            idAgentBaru,                        // 1
            judulFinal,                         // 2
            slug,                               // 3
            deskripsi || null,                  // 4
            kategori,                           // 5
            vendor || null,                     // 6
            status || null,                     // 7 (untuk CASE TERJUAL/TERSEDIA)
            hargaLimitAsli,                     // 8  -> harga
            batas_akhir_penawaran || null,      // 9  -> tanggal_lelang
            jaminanAsli,                        // 10 -> uang_jaminan
            hargaLimitAsli,                     // 11 -> nilai_limit_lelang
            link || null,                       // 12 -> link
            lokasi || null,                     // 13 -> alamat_lengkap
            provinsi || null,                   // 14
            kotaFinal,                          // 15
            kecamatan || null,                  // 16
            kelurahan || null,                  // 17
            luasNum,                            // 18 -> luas_tanah
            legalitas,                          // 19 -> legalitas (enum)
            nomorLegalitas || null,             // 20 -> nomor_legalitas
            gambar || null,                     // 21
            hargaPerMeter,                      // 22 -> harga_per_meter
            tanggal_dibuat,                     // 23
            tanggal_diupdate,                   // 24
          ],
        );

        if (result.rows[0].is_insert) {
          inserted++;
          if (inserted % 500 === 0) console.log(`INSERT: ${inserted} sejauh ini...`);
        } else {
          updated++;
          if (updated % 500 === 0) console.log(`UPDATE: ${updated} sejauh ini...`);
        }
      } catch (err) {
        fail++;
        console.error(`FAIL property ${id_listing}:`, err.message);
      }
    }

    console.log('\n--- Ringkasan Migrasi Property ---');
    console.log(
      'Insert baru:',   inserted,
      '| Update existing:', updated,
      '| Skip tanpa agent:', skippedNoAgent,
      '| Gagal:', fail,
    );
  } finally {
    await client.end();
    console.log('PostgreSQL connection closed (properties)');
  }
}

migrateProperties().catch((err) => {
  console.error('Fatal error (properties):', err);
  process.exit(1);
});
