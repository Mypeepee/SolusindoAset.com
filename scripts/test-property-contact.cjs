// Jalankan: node --test scripts/test-property-contact.cjs
// Render komponen asli dan jalankan handler API dengan session/DB terisolasi.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadTs(file, mocks) {
  const source = ts.transpileModule(readFileSync(resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name in mocks) return mocks[name];
    if (['react', 'next/server'].includes(name)) return require(name);
    throw new Error(`Dependency belum diisolasi: ${name}`);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}

const whatsappModule = loadTs('src/lib/whatsapp.ts', {});
const surveyModule = loadTs('src/lib/surveyWhatsApp.ts', { '@/lib/whatsapp': whatsappModule });
const surveyBookingModule = loadTs('src/lib/chatbot/survey-booking.ts', {
  '../../../backend/whatsapp/services/survey_time.js': require('../backend/whatsapp/services/survey_time.js'),
});

const userSession = (peran, agentId) => ({ user: { id: 'AC9', name: 'Jason', peran, role: 'AGENT', agentId } });
const property = {
  id_property: '120314', id_agent: 'AG8', title: 'Rumah uji', harga: 2135000000,
  status_tayang: 'TERSEDIA', foto_list: [], owner: { id: 'AG8', id_agent: 'AG8', name: 'Pemilik AG8', phone: '08123456789' },
};

for (const [label, file] of [
  ['Jual', 'src/app/Jual/[slug]/[agentId]/components/AgentSidebar.tsx'],
  ['Lelang', 'src/app/Lelang/[slugId]/[agentId]/components/AgentSidebarLelang.tsx'],
]) {
  for (const [scenario, session, expected] of [
    ['guest', null, 'client'],
    ['User masih memiliki agentId', userSession('USER', 'AG9'), 'client'],
    ['User memiliki ID pemilik listing', userSession('USER', 'AG8'), 'client'],
    ['User tanpa agentId', userSession('USER', null), 'client'],
    ['agent lain', userSession('AGENT', 'AG9'), 'agent'],
    ['pemilik listing', userSession('AGENT', 'AG8'), 'owner'],
    ['role legacy', { user: { id: 'AC9', role: 'AGENT', agentId: 'AG9' } }, 'agent'],
    ['agentId tanpa role', { user: { id: 'AC9', agentId: 'AG9' } }, 'client'],
  ]) {
    test(`${label}: ${scenario} menampilkan CTA ${expected} pada desktop dan mobile`, () => {
      const mocks = {
        'next-auth/react': { useSession: () => ({ data: session, status: session ? 'authenticated' : 'unauthenticated' }) },
        '@iconify/react': { Icon: () => null },
        'next/image': () => null,
        'next/link': ({ href, children }) => React.createElement('a', { href }, children),
        '@/components/Auth/SignIn': () => null,
        '@/components/Auth/SignUp': () => null,
        '@/components/PropertyDetail/CobrokeModal': () => null,
        '@/lib/leadTracking': {}, '@/lib/offerFeedback': {}, '@/lib/paymentMethods': {},
        '@/lib/pusher-client': {}, '@/lib/downloadPropertyImages': {}, '@/lib/jualPoster': {}, '@/lib/site': {},
        '@/lib/surveyWhatsApp': surveyModule,
        '@/lib/whatsapp': whatsappModule,
      };
      mocks['@/hooks/useSurveyContact'] = loadTs('src/hooks/useSurveyContact.ts', mocks);
      const Component = loadTs(file, mocks).default;
      // Link dibagikan oleh AG9, tetapi listing tetap milik AG8.
      const html = renderToStaticMarkup(React.createElement(Component, {
        data: property, presentingAgent: { id_agent: 'AG9', nama: 'Penyaji AG9' },
      }));
      const buttons = [...html.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)]
        .map((match) => match[2].replace(/<[^>]+>/g, '').trim());
      if (expected === 'client') {
        assert.equal(buttons.filter((text) => text === 'Survei').length, 2);
        assert.equal(buttons.filter((text) => text.includes('Penawaran')).length, 2);
        assert.ok(!buttons.some((text) => /Co-Broke|Brosur|Edit Properti|Poster/.test(text)));
      } else if (expected === 'agent') {
        assert.ok(buttons.some((text) => text === 'Ajukan Co-Broke'));
        assert.equal(buttons.filter((text) => text === 'Brosur').length, 2);
        assert.ok(!buttons.some((text) => /Survei|Penawaran|Edit Properti/.test(text)));
        if (label === 'Lelang') assert.ok(!html.includes('Penyaji AG9'));
      } else {
        assert.ok(buttons.some((text) => text === 'Edit Properti'));
        assert.ok(!buttons.some((text) => /Co-Broke|Survei|Penawaran/.test(text)));
      }
    });
  }
}

function bookingHarness({ session = userSession('USER', 'AG9'), savedPhone = null, conflictingPhone = false, calendarFails = false, updateFails = false } = {}) {
  const state = { phone: savedPhone, bookings: [], events: [], updates: [], broadcasts: [] };
  const db = {
    listing: { findUnique: async () => ({ id_property: 120314n, judul: 'Rumah uji' }) },
    agent: { findUnique: async () => ({ id_agent: 'AG8' }) },
    $transaction: async (run) => {
      const draft = structuredClone(state);
      const result = await run({
        pengguna: {
          findUnique: async ({ where }) => {
            assert.equal(where.id_pengguna, 'AC9');
            return { nomor_telepon: draft.phone };
          },
          findFirst: async ({ where }) => {
            assert.equal(where.id_pengguna.not, 'AC9');
            assert.ok(where.nomor_telepon.in.includes('081234567890'));
            return conflictingPhone ? { id_pengguna: 'AC10' } : null;
          },
          updateMany: async (args) => {
            if (updateFails) throw Object.assign(new Error('unique phone'), { code: 'P2002' });
            draft.updates.push(args);
            draft.phone = args.data.nomor_telepon;
            return { count: 1 };
          },
        },
        $queryRaw: async (_sql, ...values) => { draft.bookings.push(values); return [{ id_booking: 1n }]; },
        $executeRaw: async () => 1,
        acara: { findFirst: async () => null, create: async ({ data }) => { if (calendarFails) throw new Error('calendar unavailable'); draft.events.push(data); } },
      });
      Object.assign(state, draft);
      return result;
    },
  };
  const { POST } = loadTs('src/app/api/survei/booking/route.ts', {
    'next-auth': { getServerSession: async () => session },
    '@/app/api/auth/[...nextauth]/authOptions': { authOptions: {} },
    '@/lib/prisma': db,
    '@/lib/chatbot/survey-booking': surveyBookingModule,
    '@/lib/pusher-server': { pusherServer: { trigger: async (...args) => state.broadcasts.push(args) } },
  });
  return {
    state,
    submit: (overrides = {}) => POST({ json: async () => ({
      id_property: '120314', id_agent: 'AG8', nama_klien: ' Jason ', nomor_telepon: '0812-3456-7890',
      tanggal_survei: (() => { const date = new Date(Date.now() + 86400000); date.setUTCHours(6,0,0,0); return date.toISOString(); })(), id_pengguna: 'AC10', id_klien: 'AC10', ...overrides,
    }) }),
  };
}

for (const empty of [null, '', '   ']) {
  test(`survei mengisi nomor profil kosong (${JSON.stringify(empty)}) untuk akun session`, async () => {
    const { state, submit } = bookingHarness({ savedPhone: empty });
    assert.equal((await submit()).status, 200);
    assert.equal(state.phone, '+6281234567890');
    assert.equal(state.updates[0].where.id_pengguna, 'AC9');
    assert.equal(state.updates[0].data.wa_terverifikasi, false);
    assert.equal(state.bookings[0][2], 'AC9');
    assert.equal(state.bookings[0][4], 'Jason');
    assert.equal(state.bookings.length, 1);
    assert.equal(state.events.length, 1);
    assert.equal(state.broadcasts.length, 1);
  });
}

test('survei guest tidak mengubah profil atau memakai id akun dari request', async () => {
  const { state, submit } = bookingHarness({ session: null });
  assert.equal((await submit()).status, 200);
  assert.equal(state.phone, null);
  assert.equal(state.updates.length, 0);
  assert.equal(state.bookings[0][2], null);
});

test('nomor akun yang sudah terisi tetap dipertahankan', async () => {
  const { state, submit } = bookingHarness({ savedPhone: '081111111111' });
  assert.equal((await submit()).status, 200);
  assert.equal(state.phone, '081111111111');
  assert.equal(state.updates.length, 0);
  assert.equal(state.bookings[0][5], '+6281234567890');
});

for (const conflict of [{ conflictingPhone: true }, { updateFails: true }]) {
  test(`nomor akun lain ditolak tanpa booking parsial: ${JSON.stringify(conflict)}`, async () => {
    const { state, submit } = bookingHarness(conflict);
    assert.equal((await submit()).status, 409);
    assert.equal(state.phone, null);
    assert.equal(state.bookings.length, 0);
    assert.equal(state.broadcasts.length, 0);
  });
}

test('gagal menyimpan kalender membatalkan profil dan booking', async () => {
  const { state, submit } = bookingHarness({ calendarFails: true });
  assert.equal((await submit()).status, 500);
  assert.equal(state.phone, null);
  assert.equal(state.bookings.length, 0);
  assert.equal(state.broadcasts.length, 0);
});

for (const input of [{ nomor_telepon: 'abc123' }, { nomor_telepon: '+6212' }, { nama_klien: '  ' }]) {
  test(`kontak tidak valid ditolak sebelum disimpan: ${JSON.stringify(input)}`, async () => {
    const { state, submit } = bookingHarness();
    assert.equal((await submit(input)).status, 400);
    assert.equal(state.updates.length, 0);
    assert.equal(state.bookings.length, 0);
  });
}

for (const [scenario, session, dbRole, dbUser, expected] of [
  ['guest', null, 'AGENT', 'AC9', 401],
  ['User dengan agentId', userSession('USER', 'AG9'), 'AGENT', 'AC9', 401],
  ['session agent lama, DB sudah User', userSession('AGENT', 'AG9'), 'USER', 'AC9', 403],
  ['agentId milik akun lain', userSession('AGENT', 'AG9'), 'AGENT', 'AC10', 403],
  ['pemilik mengajukan ke listing sendiri', userSession('AGENT', 'AG8'), 'AGENT', 'AC9', 400],
]) {
  test(`API co-broke: ${scenario}`, async () => {
    const { POST } = loadTs('src/app/api/leads/click/route.ts', {
      'next-auth': { getServerSession: async () => session },
      '@/app/api/auth/[...nextauth]/authOptions': { authOptions: {} },
      '@/lib/prisma': {
        agent: { findUnique: async () => ({ id_agent: session.user.agentId, id_pengguna: dbUser, pengguna: { peran: dbRole } }) },
        listing: { findUnique: async () => ({ id_property: 120314n, id_agent: 'AG8' }) },
      },
      '@/lib/pusher-server': {}, '@/lib/notifications': {},
    });
    const response = await POST({ json: async () => ({ id_property: '120314', id_agent: 'AG8', source: 'cobroke', client_name: 'Klien', client_phone: '081234567890' }) });
    assert.equal(response.status, expected);
  });
}

const { buildSurveyMessage, buildSurveyWhatsAppUrl } = surveyModule;
const surveyMessage = buildSurveyMessage({
  agentName: 'Agent AG8',
  propertyTitle: 'Tanah & bangunan #120314',
  propertyUrl: 'https://solusindoaset.com/Lelang/tanah-120314/AG8',
  date: 'Kamis, 15 Oktober 2026', time: '13:00',
  clientName: 'Jason', clientPhone: '+6281234567890',
  notes: 'Mohon konfirmasi & info akses + parkir. Terima kasih! 🙏',
});

for (const [label, phone] of [
  ['nomor lokal', '081234567890'],
  ['kode negara', '6281234567890'],
  ['kode negara dengan +', '+6281234567890'],
  ['nomor lokal dengan pemisah', ' 0812-3456-7890 '],
  ['nomor internasional dengan pemisah', '+62 812-3456-7890'],
]) {
  test(`survei ${label}: membuka jalur aplikasi dengan link properti dan emoji utuh`, () => {
    const url = new URL(buildSurveyWhatsAppUrl(phone, surveyMessage));
    assert.equal(url.hostname, 'api.whatsapp.com');
    assert.equal(url.pathname, '/send');
    assert.equal(url.searchParams.get('text'), surveyMessage);
    const message = url.searchParams.get('text');
    assert.ok(message.includes('https://solusindoaset.com/Lelang/tanah-120314/AG8'));
    assert.ok(message.includes('📅 Tanggal: Kamis, 15 Oktober 2026\n🕐 Waktu: 13:00 WIB'));
    assert.ok(message.includes('👤 Nama: Jason\n📱 No. Telp: +6281234567890'));
    assert.ok(message.includes('📝 Catatan: Mohon konfirmasi & info akses + parkir. Terima kasih! 🙏'));
    assert.ok(!message.includes('\uFFFD'));
    assert.equal(url.searchParams.get('phone'), '6281234567890');
  });
}
