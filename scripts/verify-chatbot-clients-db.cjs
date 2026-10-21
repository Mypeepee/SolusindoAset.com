// Run explicitly: node scripts/verify-chatbot-clients-db.cjs
// All client fixtures are rolled back; no WhatsApp messages are sent.
const assert = require('node:assert/strict');
const { randomInt } = require('node:crypto');
require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });
const { PrismaClient } = require('@prisma/client');
const { captureClient } = require('../src/lib/chatbot/client-capture.ts');
const prisma = new PrismaClient();
const ROLLBACK = new Error('TEST_ROLLBACK');
const result = {};
(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const db = { $transaction: (work) => work(tx) };
      const freshPhone = async () => {
        for (let i = 0; i < 10; i++) {
          const phone = '628000' + randomInt(10000000, 99999999);
          const old = await tx.$queryRaw`SELECT id_klien FROM public.klien WHERE regexp_replace(coalesce(nomor_whatsapp, ''), '[^0-9]', '', 'g') IN (${phone}, ${'0' + phone.slice(2)}) LIMIT 1`;
          if (!old.length) return phone;
        }
        throw new Error('FIXTURE_PHONE_UNAVAILABLE');
      };
      const phone = await freshPhone(), now = Date.now();
      const criteria = { location: 'Surabaya Barat', city: 'Surabaya', region_group: 'barat', transaction_type: 'LELANG', category: 'RUMAH', max_price: 500000000, min_land_area_m2: 150, nearby: { query: 'pintu tol', radius_m: 2000 } };
      const input = { phone, name: 'Klien Pengujian', criteria, captured_at: now };
      const created = await captureClient(db, input);
      assert.equal(created.status, 'created'); assert.equal(created.id_agent, 'AG108');
      let row = await tx.klien.findUniqueOrThrow({ where: { id_klien: created.id_klien } });
      assert.equal(row.nomor_whatsapp, phone); assert.equal(row.id_agent, 'AG108'); assert.equal(row.nama, input.name);
      assert.equal(Number(row.chatbot_budget_max), 500000000); assert.equal(Number(row.chatbot_luas_tanah_min), 150);
      assert.deepEqual(row.chatbot_jenis_aset, ['RUMAH']); assert.deepEqual(row.chatbot_kriteria.nearby, criteria.nearby);
      result.create_full_funnel = true;
      let prefs = await tx.preferensiKlien.findMany({ where: { id_klien: row.id_klien } });
      assert.equal(prefs.length, 7);
      assert.deepEqual(prefs.map(p => p.loc_kecamatan).sort(), ['Asem Rowo', 'Benowo', 'Lakarsantri', 'Pakal', 'Sambikerep', 'Sukomanunggal', 'Tandes'].sort());
      assert.ok(prefs.every(p => Number(p.budget_max) === 500000000 && Number(p.luas_min) === 150 && p.dekat_nilai === 'kelas:PINTU_TOL@surabaya' && p.dekat_radius === 2000));
      result.editable_preferences_and_region_expansion = true;
      await tx.klien.update({ where: { id_klien: row.id_klien }, data: { catatan: 'Catatan manual harus tetap', status: 'sudah_dikontak', sumber: 'referral', tanggal_kontak_terakhir: new Date(now + 1000) } });
      const updated = await captureClient(db, { ...input, criteria: { ...criteria, max_price: 600000000 }, captured_at: now + 100 });
      assert.equal(updated.id_klien, created.id_klien); assert.equal(updated.status, 'updated');
      assert.equal(await tx.klien.count({ where: { id_agent: 'AG108', chatbot_nomor_whatsapp: phone } }), 1);
      row = await tx.klien.findUniqueOrThrow({ where: { id_klien: created.id_klien } });
      assert.equal(row.status, 'sudah_dikontak'); assert.equal(row.sumber, 'referral'); assert.equal(row.catatan, 'Catatan manual harus tetap');
      assert.equal(row.tanggal_kontak_terakhir.getTime(), now + 1000);
      assert.equal(Number(row.chatbot_budget_max), 600000000); result.update_without_duplicates_or_manual_data_loss = true;
      assert.equal((await captureClient(db, input)).status, 'stale');
      assert.equal(Number((await tx.klien.findUniqueOrThrow({ where: { id_klien: row.id_klien } })).chatbot_budget_max), 600000000);
      result.stale_retry_protected = true;
      prefs = await tx.preferensiKlien.findMany({ where: { id_klien: row.id_klien } });
      assert.equal(prefs.length, 7); assert.ok(prefs.every(p => Number(p.budget_max) === 600000000));
      const manuallyEdited = prefs[0];
      await tx.preferensiKlien.update({ where: { id_preferensi: manuallyEdited.id_preferensi }, data: { budget_max: 450000000, catatan: 'Suntingan Owner' } });
      const latest = { ...input, criteria: { ...criteria, max_price: 600000000 }, captured_at: now + 200 };
      await captureClient(db, latest);
      assert.equal(Number((await tx.preferensiKlien.findUniqueOrThrow({ where: { id_preferensi: manuallyEdited.id_preferensi } })).budget_max), 450000000);
      assert.equal(await tx.preferensiKlien.count({ where: { id_klien: row.id_klien } }), 7);
      await tx.preferensiKlien.delete({ where: { id_preferensi: prefs[1].id_preferensi } });
      await captureClient(db, { ...latest, captured_at: now + 201 });
      assert.equal(await tx.preferensiKlien.count({ where: { id_klien: row.id_klien } }), 6);
      await captureClient(db, { ...latest, criteria: { ...latest.criteria, max_price: 700000000 }, captured_at: now + 202 });
      assert.equal((await tx.preferensiKlien.findUniqueOrThrow({ where: { id_preferensi: manuallyEdited.id_preferensi } })).catatan, 'Suntingan Owner');
      result.manual_edits_and_deletions_preserved = true;
      const legacyPhone = await freshPhone();
      const legacy = await tx.klien.create({ data: { id_agent: 'AG108', nama: 'Nama Klien Lama', nomor_whatsapp: '0' + legacyPhone.slice(2), status: 'closing', sumber: 'website' } });
      const reused = await captureClient(db, { ...input, phone: legacyPhone, name: null });
      assert.equal(reused.id_klien, legacy.id_klien);
      const old = await tx.klien.findUniqueOrThrow({ where: { id_klien: legacy.id_klien } });
      assert.equal(old.nama, 'Nama Klien Lama'); assert.equal(old.status, 'closing'); assert.equal(old.sumber, 'website');
      assert.equal(old.nomor_whatsapp, legacyPhone);
      result.legacy_local_phone_reused = true;
      const unknownPhone = await freshPhone();
      const unknown = await captureClient(db, { ...input, phone: unknownPhone, name: null });
      assert.equal((await tx.klien.findUniqueOrThrow({ where: { id_klien: unknown.id_klien } })).nama, `Kontak WhatsApp ${unknownPhone}`);
      result.honest_name_fallback = true;
      await captureClient(db, { ...input, phone: unknownPhone, name: null, criteria: { location: 'Tandes', city: 'Surabaya', district: 'Tandes', transaction_type: 'LELANG', category: 'RUMAH', max_price: 300000000, min_land_area_m2: null, max_land_area_m2: null, nearby: { query: 'sekolah', radius_m: 100 } }, captured_at: now + 1000 });
      const flexible = await tx.preferensiKlien.findMany({ where: { id_klien: unknown.id_klien } });
      assert.equal(flexible.length, 1); assert.equal(flexible[0].luas_min, null); assert.equal(flexible[0].luas_max, null);
      assert.equal(flexible[0].loc_kecamatan, 'Tandes'); assert.equal(flexible[0].dekat_radius, 100);
      result.flexible_land_is_null_and_precise_radius_saved = true;
      await captureClient(db, { ...input, phone: unknownPhone, criteria: { ...criteria, nearby: { query: 'sekolah dan pintu tol atau stasiun', radius_m: 2000 } }, captured_at: now + 1100 });
      const compound = await tx.preferensiKlien.findMany({ where: { id_klien: unknown.id_klien } });
      assert.equal(compound.length, 7); assert.ok(compound.every(p => p.dekat_nilai === 'kueri:sekolah dan pintu tol atau stasiun'));
      result.compound_landmark_semantics_retained = true;
      throw ROLLBACK;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
    result.all_fixtures_rolled_back = true;
  }
  console.log(JSON.stringify(result));
})().catch((error) => { console.error(JSON.stringify({ verification: 'failed', code: error.code || error.name })); process.exitCode = 1; }).finally(() => prisma.$disconnect());
