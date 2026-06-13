// scripts/create-booking-survei.js
import pg from 'pg';

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:01082003Jason@127.0.0.1:5432/kosku?schema=public';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_survei (
        id_booking      BIGSERIAL PRIMARY KEY,
        id_property     BIGINT       NOT NULL REFERENCES listing(id_property) ON DELETE CASCADE,
        id_agent        VARCHAR(20)  NOT NULL REFERENCES agent(id_agent)      ON DELETE CASCADE,
        nama_klien      VARCHAR(255) NOT NULL,
        nomor_telepon   VARCHAR(20)  NOT NULL,
        tanggal_survei  TIMESTAMPTZ  NOT NULL,
        status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
        catatan         TEXT,
        tanggal_dibuat  TIMESTAMPTZ  NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_booking_survei_agent
        ON booking_survei(id_agent);

      CREATE INDEX IF NOT EXISTS idx_booking_survei_property
        ON booking_survei(id_property);

      CREATE INDEX IF NOT EXISTS idx_booking_survei_tanggal
        ON booking_survei(tanggal_survei);
    `);

    console.log('✅ Tabel booking_survei berhasil dibuat (atau sudah ada).');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Gagal:', err.message);
  process.exit(1);
});
