// scripts/migrate-agents.js
import pg from 'pg';

const { Client } = pg;

// SESUAIKAN koneksi
const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:01082003Jason@127.0.0.1:5432/kosku?schema=public';

function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.trim().replace(/\s+/g, '');
  if (p.startsWith('+62')) return p;
  if (p.startsWith('62')) return '+' + p;
  if (p.startsWith('0')) return '+62' + p.slice(1);
  return p;
}

// jabatan dari account.roles
function mapJabatanFromRoles(roles) {
  if (!roles) return 'AGENT';
  const s = roles.toLowerCase();
  if (s.includes('principal')) return 'PRINCIPAL';
  if (s.includes('stoker')) return 'STOKER';
  if (s.includes('owner')) return 'OWNER';
  if (s.includes('agent')) return 'AGENT';
  return 'AGENT';
}

function mapStatusKeanggotaan(status) {
  if (!status) return 'PENDING';
  const s = status.toUpperCase();
  if (s === 'AKTIF') return 'AKTIF';
  if (s === 'SUSPEND') return 'SUSPEND';
  if (s === 'PENDING') return 'PENDING';
  return 'PENDING';
}

function parseIntOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

function parseFloatOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? null : n;
}

function normalizeDateString(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s; // biarkan PG yang cast
}

async function migrateAgents() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL (agents)');

  try {
    // Ambil semua agent_tampungan dengan email (seperti script lama)
    const { rows } = await client.query(`
      SELECT *
      FROM public.agent_tampungan
      WHERE email IS NOT NULL
      ORDER BY id_account
    `);

    console.log('Total agent_tampungan ditemukan:', rows.length);

    let success = 0;
    let alreadyExist = 0;
    let skippedNoUser = 0;
    let fail = 0;

    for (const row of rows) {
      const {
        id_account,
        id_agent,     // id_agent lama, contoh: AG001
        email,
        nama,
        kota,
        nomor_telepon,
        roles,
        instagram,
        facebook,
        tanggal_join,
        picture,
        status,
        rating,
        jumlah_penjualan,
        lokasi_kerja,
        gambar_ktp,
        gambar_npwp,
        upline_id,    // untuk mapping kantor
      } = row;

      try {
        // 1) Resolve pengguna berdasarkan EMAIL agent (agent_tampungan.email) lebih dulu.
        //    Email agent = identitas agent yang sebenarnya. account.email kadang BEDA
        //    dengan email agent (mis. AG001 Jason: account=solusindosinergi,
        //    agent_tampungan=jasoncliendo) sehingga properti nyasar ke pengguna salah.
        //    Fallback ke mapping_pengguna by id_account jika email tidak ketemu.
        let idPenggunaBaru = null;
        if (email) {
          const byEmail = await client.query(
            `SELECT id_pengguna FROM public.pengguna WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) LIMIT 1`,
            [email],
          );
          if (byEmail.rowCount > 0) idPenggunaBaru = byEmail.rows[0].id_pengguna;
        }
        if (!idPenggunaBaru) {
          const mapUserRes = await client.query(
            `SELECT id_pengguna_baru FROM public.mapping_pengguna WHERE id_account_lama = $1`,
            [id_account],
          );
          if (mapUserRes.rowCount === 0) {
            skippedNoUser++;
            console.warn(
              `SKIP (tidak ada mapping pengguna): ${id_account} (${email})`,
            );
            continue;
          }
          idPenggunaBaru = mapUserRes.rows[0].id_pengguna_baru;
        }

        // 2) ambil roles dari account untuk jabatan
        const accRes = await client.query(
          `SELECT roles FROM public.account WHERE id_account = $1`,
          [id_account],
        );
        const rolesAccount = accRes.rowCount ? accRes.rows[0].roles : roles;
        const jabatanFinal = mapJabatanFromRoles(rolesAccount);

        // 3) nama_kantor & kota_area (logika lama dipertahankan)
        let kantorFinal;
        if (upline_id === 'AG023' || id_agent === 'AG023') {
          kantorFinal = 'Ray White Diponegoro';
        } else if (id_agent === 'AG014') {
          kantorFinal = 'Ray White Diponegoro';
        } else if (upline_id === 'AG022' || id_agent === 'AG022') {
          kantorFinal = 'Era Ventura';
        } else {
          kantorFinal = 'Solusindo Premier Pusat';
        }

        const kotaAreaFinal = lokasi_kerja || kota || 'KOTA TIDAK DIKETAHUI';

        const wa = normalizePhone(nomor_telepon);
        const ratingNum = parseFloatOrNull(rating) ?? 0.0;
        const jumlahClosingInt = 0;
        const totalOmsetNum = 0.0;
        const jumlahPenjualanInt = parseIntOrNull(jumlah_penjualan) ?? 0;

        const statusFinal = mapStatusKeanggotaan(status);
        const tanggalGabungFinal = normalizeDateString(tanggal_join);

        const idAgentLama = id_agent; // AG001 lama

        // 4) INSERT ke agent (schema baru, TANPA kolom id_agent_lama)
        const insertRes = await client.query(
          `
          INSERT INTO public.agent (
            id_pengguna,
            nama_kantor,
            kota_area,
            jabatan,
            id_upline,
            rating,
            jumlah_closing,
            total_omset,
            nomor_whatsapp,
            poin,
            foto_ktp_url,
            foto_npwp_url,
            foto_profil_url,
            nama_bank,
            nomor_rekening,
            atas_nama_rekening,
            link_instagram,
            link_tiktok,
            link_facebook,
            status_keanggotaan,
            tanggal_gabung
          )
          VALUES (
            $1, $2, $3, $4, NULL,
            $5, $6, $7, $8,
            0,
            $9, $10, $11,
            NULL, NULL, $12,
            $13, NULL, $14,
            $15, $16
          )
          ON CONFLICT (id_pengguna) DO NOTHING
          RETURNING id_agent
        `,
          [
            idPenggunaBaru,      // 1
            kantorFinal,         // 2
            kotaAreaFinal,       // 3
            jabatanFinal,        // 4
            ratingNum,           // 5
            jumlahClosingInt,    // 6
            totalOmsetNum,       // 7
            wa,                  // 8
            gambar_ktp,          // 9
            gambar_npwp,         // 10
            picture,             // 11
            nama,                // 12 (atas_nama_rekening)
            instagram,           // 13
            facebook,            // 14
            statusFinal,         // 15
            tanggalGabungFinal,  // 16
          ],
        );

        let idAgentBaru;
        if (insertRes.rowCount > 0) {
          idAgentBaru = insertRes.rows[0].id_agent;
          success++;
          console.log(`OK agent: ${id_account} (${email}) => ${idAgentBaru}`);
        } else {
          // Agent sudah ada dari run sebelumnya, ambil id_agent yang sudah ada
          const existingRes = await client.query(
            `SELECT id_agent FROM public.agent WHERE id_pengguna = $1`,
            [idPenggunaBaru],
          );
          idAgentBaru = existingRes.rows[0].id_agent;
          alreadyExist++;
          console.log(`EXIST agent: ${id_account} (${email}) => ${idAgentBaru}`);
        }

        // 5) Simpan mapping agent lama -> baru
        if (idAgentLama) {
          await client.query(
            `
            INSERT INTO public.mapping_agent (id_agent_lama, id_agent_baru)
            VALUES ($1, $2)
            ON CONFLICT (id_agent_lama) DO NOTHING
          `,
            [idAgentLama, idAgentBaru],
          );
        }
      } catch (err) {
        fail++;
        console.error(`FAIL agent: ${id_account} (${email}):`, err.message);
      }
    }

    console.log('\n--- Fase 2: Update id_upline menggunakan mapping ---');

    // Ambil semua agent_tampungan yang punya upline_id
    const { rows: uplineRows } = await client.query(`
      SELECT id_agent, upline_id
      FROM public.agent_tampungan
      WHERE upline_id IS NOT NULL AND upline_id != '' AND email IS NOT NULL
    `);

    let uplineSuccess = 0;
    let uplineSkipped = 0;
    let uplineFail = 0;

    for (const { id_agent: idAgentLama, upline_id: uplineIdLama } of uplineRows) {
      try {
        // Cari id_agent_baru dari mapping
        const agentMapRes = await client.query(
          `SELECT id_agent_baru FROM public.mapping_agent WHERE id_agent_lama = $1`,
          [idAgentLama],
        );
        if (agentMapRes.rowCount === 0) {
          uplineSkipped++;
          continue;
        }
        const idAgentBaru = agentMapRes.rows[0].id_agent_baru;

        // Cari id_upline_baru dari mapping
        const uplineMapRes = await client.query(
          `SELECT id_agent_baru FROM public.mapping_agent WHERE id_agent_lama = $1`,
          [uplineIdLama],
        );
        if (uplineMapRes.rowCount === 0) {
          uplineSkipped++;
          console.warn(
            `SKIP upline: ${idAgentLama} -> upline lama ${uplineIdLama} tidak ditemukan di mapping`,
          );
          continue;
        }
        const idUplineBaru = uplineMapRes.rows[0].id_agent_baru;

        await client.query(
          `UPDATE public.agent SET id_upline = $1 WHERE id_agent = $2`,
          [idUplineBaru, idAgentBaru],
        );

        uplineSuccess++;
        console.log(
          `OK upline: ${idAgentLama} (${idAgentBaru}) -> upline ${uplineIdLama} (${idUplineBaru})`,
        );
      } catch (err) {
        uplineFail++;
        console.error(`FAIL upline: ${idAgentLama}:`, err.message);
      }
    }

    console.log('Update upline selesai');
    console.log(
      'Upline sukses:',
      uplineSuccess,
      'Skip:',
      uplineSkipped,
      'Gagal:',
      uplineFail,
    );

    console.log('\n--- Ringkasan Migrasi Agent ---');
    console.log(
      'Insert baru:',
      success,
      '| Sudah ada:',
      alreadyExist,
      '| Skip tanpa pengguna:',
      skippedNoUser,
      '| Gagal:',
      fail,
    );
  } finally {
    await client.end();
    console.log('PostgreSQL connection closed (agents)');
  }
}

migrateAgents().catch((err) => {
  console.error('Fatal error (agents):', err);
  process.exit(1);
});
