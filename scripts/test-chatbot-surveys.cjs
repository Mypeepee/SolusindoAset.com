const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const ts = require('typescript');
const { NextRequest } = require('next/server');
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(__dirname, '..', file); if (!/\.[cm]?[jt]sx?$/.test(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require','module','exports',code)(name => Object.hasOwn(overrides,name) ? overrides[name] : name.startsWith('@/') ? load('src/'+name.slice(2)) : name.startsWith('.') ?
      resolve(dirname(file),name).includes('/backend/') ? require(resolve(dirname(file),name)) : load(resolve(dirname(file),name)) : require(name), module, module.exports);
    return module.exports;
  }
  return load;
}
const service = loader()('src/lib/chatbot/survey-booking.ts');
const NOW = Date.parse('2026-10-21T09:00:00+07:00');
const input = changes => ({ action:'book', agent_id:'AG108', property_id:'123', phone:'6280000000001', name:'Koko', date:'2026-10-22', time:'10:00', request_id:'11111111-1111-4111-8111-111111111111', ...changes });
function fixture() {
  let bookings = [], events = [], type = 'SECONDARY', failCalendar = false;
  const locks = [];
  const tx = {
    agent:{findUnique:async()=>({status_keanggotaan:'AKTIF',pengguna:{status_akun:'AKTIF',nama_lengkap:'Agen'}})},
    listing:{findUnique:async()=>({judul:'Rumah',jenis_transaksi:type,status_tayang:'TERSEDIA',bukan_properti:false})},
    klien:{findFirst:async()=>({id_klien:'KL00001'})},
    $executeRaw:async(strings,...values)=>{locks.push(values);return 1;},
    $queryRaw:async(strings,...values)=>{
      const sql=strings.join('?');
      if(sql.includes('SELECT id_booking'))return bookings.filter(b=>b.request_id===values[0]);
      assert.match(sql,/INSERT INTO public.booking_survei/);
      const row={id_booking:BigInt(bookings.length+1),id_property:values[0],id_agent:values[1],nama_klien:values[2],nomor_telepon:values[3],tanggal_survei:values[4],status:'PENDING',request_id:values[6]};
      bookings.push(row);return [{id_booking:row.id_booking}];
    },
    acara:{findFirst:async({where})=>events.find(e=>e.id_agent===where.id_agent&&e.tanggal_mulai<where.tanggal_mulai.lt&&e.tanggal_selesai>where.tanggal_selesai.gt&& !['CANCELLED','DRAFT'].includes(e.status_acara))||null,
      findMany:async({where})=>events.filter(e=>e.id_agent===where.id_agent&&e.tanggal_mulai<where.tanggal_mulai.lt&&e.tanggal_selesai>where.tanggal_selesai.gt&&!['CANCELLED','DRAFT'].includes(e.status_acara)),
      create:async({data})=>{if(failCalendar)throw new Error('calendar failed');const e={id_acara:BigInt(events.length+1),...data};events.push(e);return e;}},
  };
  const db={$transaction:async work=>{const before=[structuredClone(bookings),structuredClone(events)];try{return await work(tx);}catch(e){[bookings,events]=before;throw e;}}};
  return {db,tx,locks,get bookings(){return bookings;},get events(){return events;},type(t){type=t;},failCalendar(){failCalendar=true;}};
}
test('explicitly confirmed appointment creates one pending booking and one calendar entry on the presenting agent',async()=>{
  const f=fixture();const r=await service.chatbotSurvey(f.db,input(),NOW);
  assert.equal(r.status,'PENDING');assert.equal(f.bookings.length,1);assert.equal(f.events.length,1);
  assert.equal(f.bookings[0].id_agent,'AG108');assert.equal(f.events[0].id_agent,'AG108');assert.equal(f.events[0].id_klien_ref,'KL00001');
  assert.equal(f.bookings[0].tanggal_survei.toISOString(),'2026-10-22T03:00:00.000Z');assert.equal(f.events[0].tipe_acara,'SITE_VISIT');assert.equal(f.locks.length,1);
});
test('repeat HTTP requests reuse the receipt; reusing its key with changed contact/property/time is rejected',async()=>{
  const f=fixture();await service.chatbotSurvey(f.db,input(),NOW);const again=await service.chatbotSurvey(f.db,input(),NOW);
  assert.equal(again.created,false);assert.equal(f.bookings.length,1);assert.equal(f.events.length,1);
  for(const change of [{time:'11:00'},{property_id:'456'},{phone:'6280000000002'},{agent_id:'AG999'}])await assert.rejects(()=>service.chatbotSurvey(f.db,input(change),NOW),/SURVEY_REQUEST_CONFLICT/);
});
test('a competing request for the same agent slot is blocked, but a cancelled event releases its slot',async()=>{
  const f=fixture();await service.chatbotSurvey(f.db,input(),NOW);
  await assert.rejects(()=>service.chatbotSurvey(f.db,input({request_id:'22222222-2222-4222-8222-222222222222'}),NOW),/SURVEY_SLOT_TAKEN/);
  let a=await service.surveyAvailability(f.tx,'AG108','2026-10-22',NOW);assert.equal(a.blockedSlots.find(s=>s.label==='10:00').blocked,true);
  f.events[0].status_acara='CANCELLED';a=await service.surveyAvailability(f.tx,'AG108','2026-10-22',NOW);assert.equal(a.blockedSlots.find(s=>s.label==='10:00').blocked,false);
});
test('failure writing the calendar rolls back the booking too; auctions never create an assisted survey',async()=>{
  const f=fixture();f.failCalendar();await assert.rejects(()=>service.chatbotSurvey(f.db,input(),NOW),/calendar failed/);assert.equal(f.bookings.length,0);
  const auction=fixture();auction.type('LELANG');await assert.rejects(()=>service.chatbotSurvey(auction.db,input(),NOW),/AUCTION_EXTERIOR_ONLY/);assert.equal(auction.bookings.length,0);assert.equal(auction.locks.length,0);
});
test('past, rolled-over, unsupported-hour dates and caller-selected private fields are rejected',async()=>{
  const f=fixture();for(const change of [{date:'2026-02-30'},{date:'2026-10-20'},{time:'12:00'},{time:'10:30'},{date:'2027-10-21'}])await assert.rejects(()=>service.chatbotSurvey(f.db,input(change),NOW),/INVALID_SURVEY_TIME/);
  for(const change of [{phone:'081234567890'},{property_id:123},{id_klien:'PG1'},{status:'CONFIRMED'},{id_acara:'1'}])assert.equal(service.validSurveyRequest(input(change)),false);
  await assert.rejects(()=>service.ensureSurveyAvailable(f.tx,'AG108',new Date('2026-10-22T10:00:30+07:00'),NOW),/INVALID_SURVEY_TIME/);
  assert.equal(f.bookings.length,0);
});
test('internal survey API authenticates, rejects extra fields, and announces only newly committed bookings',async()=>{
  const previous=process.env.CHATBOT_CLIENT_TOKEN;process.env.CHATBOT_CLIENT_TOKEN='s'.repeat(32);let writes=0,notices=0;
  const route=loader({'@/lib/prisma':{},'@/lib/chatbot/server-access':{readChatbotBody:r=>r.json()},'@/lib/pusher-server':{pusherServer:{trigger:async()=>{notices++;}}},
    '@/lib/chatbot/survey-booking':{...service,chatbotSurvey:async()=>({booking_id:'1',created:++writes===1})}})('src/app/api/internal/chatbot/surveys/route.ts');
  const request=(data,token=process.env.CHATBOT_CLIENT_TOKEN)=>new NextRequest('http://localhost/api/internal/chatbot/surveys',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(data)});
  try{
    assert.equal((await route.POST(request(input(),'wrong'))).status,401);assert.equal((await route.POST(request(input({status:'CONFIRMED'})))).status,400);assert.equal(writes,0);
    assert.equal((await route.POST(request(input()))).status,200);assert.equal((await route.POST(request(input()))).status,200);assert.equal(writes,2);assert.equal(notices,1);
  }finally{if(previous===undefined)delete process.env.CHATBOT_CLIENT_TOKEN;else process.env.CHATBOT_CLIENT_TOKEN=previous;}
});
