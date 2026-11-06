import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { serviceDirectory } from '../config.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { AUCTION_BUDGET_RANGE_QUESTION } from '../services/budget_response.js';

// This runner never loads credentials, connects WhatsApp, calls an AI provider,
// books a survey, writes CRM data, or creates live stock-check tasks.
const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = resolve(argument('output') || join(serviceDirectory, 'docs', 'simulasi-budget-mou'));
const contextPath = argument('context'), renderPdf = process.argv.includes('--pdf');
const now = Date.parse('2026-11-04T12:00:00+07:00'), phone = '6280000000001';
const example = {id:'9500001',name:'Apartemen contoh simulasi',transaction_type:'LELANG',category:'APARTEMEN',
  limit_price:401000000,deposit:110000000,auction_at:'2025-10-23T17:00:00Z',location:'Kab. Badung',
  full_address:'Alamat sintetis untuk simulasi di Kab. Badung',address:{city:'Kab. Badung',province:'Bali'},
  specifications:{land_area_m2:42,has_building:true},publication:{status:'TERSEDIA'},
  detail_url:'https://solusindoaset.com/Lelang/apartemen-contoh-9500001'};
const asset = contextPath ? JSON.parse(await readFile(resolve(contextPath),'utf8')).asset : example;
assert.ok(asset?.id && asset.detail_url && asset.limit_price);
await mkdir(output,{recursive:true});
let preparedFile;
async function draft(id) {
  assert.equal(id,asset.id);
  if (!preparedFile) {
    if (renderPdf) {
      const {renderMouDraft} = await import('../../../src/lib/server/chatbotMouDraft.mjs');
      const {docxToPdf} = await import('../../../src/lib/server/docxToPdf.ts');
      preparedFile = {...await renderMouDraft(asset,{convertDocx:docx=>docxToPdf(docx,'wa-budget-preview')}),assetId:id};
      await writeFile(join(output,preparedFile.filename),preparedFile.buffer,{mode:0o600});
    } else preparedFile={assetId:id,filename:`Draf_MOU_Aset_${id}.pdf`,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nOffline transport fixture')};
  }
  return preparedFile;
}

const opening = `Halo Jason Christopher Liendo �\n\nSaya tertarik dengan properti lelang berikut, apakah masih tersedia?\n\n� *${asset.name}*\n� ${asset.location}\n� *Rp ${asset.limit_price.toLocaleString('id-ID')}*\n� Kode: ${asset.id}\n\n� Detail lengkap:\n${asset.detail_url}\n\nMohon infonya, terima kasih! �`;
async function simulate(turns) {
  const replies=[],documents=[],errors=[],transcript=[];
  const config={transport:'baileys',requirePropertyInquiry:true,replyDelayMs:0,maxSessions:10,maxPending:20,maxPendingPerPhone:10,maxDedup:100,sessionTtlMs:86400000,sessionIdleMs:2700000};
  const store=new MemoryStore(config,()=>now);
  const processor=new MessageProcessor({config,store,agentId:'AG108',now:()=>now,
    catalog:{async resolve(text,previousId,criteria){
      if(criteria) return {asset:null,catalog:[],status:'not_found',source:'simulation'};
      const matches=String(text).includes(asset.id)||previousId===asset.id;
      return {asset:matches?structuredClone(asset):null,catalog:[],status:matches?'matched':'not_found',source:contextPath?'database_listing_publik_snapshot':'synthetic_fixture'};
    }},checks:{stockResult:()=>null,async enqueue(){return {status:'pending',notification_status:'sent'};}},
    documents:{generate:draft},
    ai:{generate(){assert.fail('These clear replies must work without an AI call');}},
    whatsapp:{async sendText(_to,text){replies.push(text);return `simulation-text-${replies.length}`;},
      async sendDocument(_to,file,caption){documents.push({filename:file.filename,asset_id:file.assetId,caption});return `simulation-pdf-${documents.length}`;}},
    logger:{error:error=>errors.push(error)}});
  let sequence=0;
  const send=async text=>{
    const before=replies.length,filesBefore=documents.length;
    processor.acceptBatch([{id:`sim-${++sequence}`,from:phone,type:'text',text,timestamp:now}]);await processor.drain();
    return {user:text,replies:replies.slice(before),attachments:documents.slice(filesBefore)};
  };
  await send(opening); await send('boleh');
  const initialQuestion=replies.at(-1).split('\n').at(-1);
  for(const text of turns) transcript.push(await send(text));
  assert.deepEqual(errors,[]);
  return {initialQuestion,turns:transcript,documents:documents.length,consultation:store.get(phone).consultation,
    conversion:store.get(phone).conversion.mode};
}

const cases=[
  {name:'Terlalu tinggi → budget Rp400–500 juta',turns:['terlalu tinggi','400–500 juta'],documents:0},
  {name:'Singkatan keberatan',turns:['gk masuk budget pak','500 juta'],documents:0},
  {name:'Bahasa Jawa',turns:['kemahalen pak','500'],documents:0},
  {name:'Bahasa Inggris',turns:['too expensive','I have 400 to 500 million'],documents:0},
  {name:'Oke cocok → MOU satu kali',turns:['oke cocok','baik'],documents:1},
  {name:'Persetujuan santai',turns:['pas banget'],documents:1},
  {name:'Persetujuan bahasa Jawa',turns:['nggih sampun pas'],documents:1},
  {name:'Persetujuan bahasa Inggris',turns:['yes it fits my budget'],documents:1},
  {name:'Masih ragu',turns:['cocok tapi masih pikir dulu'],documents:0},
  {name:'Jawaban ambigu diklarifikasi',turns:['hmm'],documents:0},
];
const results=[];
for(const item of cases){
  const result=await simulate(item.turns);
  assert.equal(result.documents,item.documents,item.name);
  if(item.turns[0]==='terlalu tinggi')assert.equal(result.turns[0].replies[0],AUCTION_BUDGET_RANGE_QUESTION);
  results.push({name:item.name,...result});
}
const lines=['# Simulasi budget dan draf MOU','',
  `Aset ${asset.id}. Tanggal simulasi: 4 November 2026. Data: ${contextPath?'snapshot proyeksi properti publik yang dibaca untuk sesi ini':'fixture sintetis'}.`,
  'Tidak ada WhatsApp sungguhan, panggilan AI eksternal, pencatatan CRM, atau pengiriman cek stok.',
  `Lampiran: ${renderPdf?'PDF draf dibuat dengan template MOU dan converter aplikasi yang sama':'PDF transport ditirukan; gunakan --pdf untuk membuat dokumen nyata'}.`,''];
for(const item of results){
  lines.push(`## ${item.name}`,'',`Bot sebelum jawaban: ${item.initialQuestion}`,'');
  for(const turn of item.turns){
    lines.push(`**Klien:** ${turn.user}`,'');
    for(const reply of turn.replies)lines.push(`**Bot:** ${reply}`,'');
    for(const file of turn.attachments)lines.push(`**Lampiran:** ${file.filename} (aset ${file.asset_id})`,'',file.caption,'');
  }
  lines.push(`Validasi: ${item.documents} lampiran, mode ${item.conversion}.`,'');
}
await writeFile(join(output,'transkrip.md'),lines.join('\n'));
await writeFile(join(output,'hasil.json'),JSON.stringify({real_whatsapp_sent:false,external_ai_called:false,rendered_pdf:renderPdf,asset_id:asset.id,results},null,2));
console.log(JSON.stringify({scenarios:results.length,passed:results.length,real_whatsapp_sent:false,external_ai_called:false,
  transcript:join(output,'transkrip.md'),pdf:renderPdf?join(output,preparedFile.filename):null}));
