import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { serviceDirectory } from '../config.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ClientOutbox } from '../state/client_outbox.js';
import { auctionCostEstimate } from '../services/property_costs.js';
import { LINKED_SEARCH_CONFIRMATION } from '../services/linked_search.js';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const liveDatabase = process.argv.includes('--database');
const output = resolve(argument('output') || join(serviceDirectory, 'docs', 'simulasi-kriteria-dari-link'));
const propertyId = argument('property') || '31551';
const synthetic = {id:'9350001',name:'Rumah sumber simulasi',transaction_type:'LELANG',category:'RUMAH',
  limit_price:401000000,deposit:100000000,auction_at:'2025-10-23T17:00:00Z',location:'Legian, Kuta, Kab. Badung',
  full_address:'Alamat sumber sintetis di Legian, Kuta, Kab. Badung',address:{city:'Kab. Badung',province:'Bali',district:'Kuta',village:'Legian'},
  specifications:{land_area_m2:42,building_area_m2:42,has_building:true},publication:{status:'TERSEDIA'},
  detail_url:'https://solusindoaset.com/Lelang/sumber-simulasi-9350001'};
const cases = [
  {name:'Konfirmasi seluruh kriteria',turns:['iya'],category:null,land:null},
  {name:'Koreksi jenis properti',turns:['oh saya apartemen saja'],category:'APARTEMEN',land:null},
  {name:'Jenis → minimum luas tanah → revisi minimum',turns:['oh saya apartemen saja','oh saya cari minim luasan 100','luasan minimal 150'],category:'APARTEMEN',land:150},
  {name:'Minimum luas sebagai koreksi pertama',turns:['minimal luasan 100'],category:null,land:100},
  {name:'Revisi budget mempertahankan daerah dan jenis',turns:['oh saya apartemen saja','budget saya maksimal 450 juta'],category:'APARTEMEN',land:null,budget:450000000},
  {name:'Tolak rangkuman → perbaiki jenis',turns:['bukan','apartemen saja'],category:'APARTEMEN',land:null},
];
const reports = [], fixturePhones = [];
let db, getKnowledge, saveClient;

async function runCase(item, asset, tx = null) {
  let clock = Date.now(), sequence = 0;
  const phone = '628000' + randomInt(10000000,99999999);
  if(tx) assert.equal(await tx.klien.count({where:{OR:[{nomor_whatsapp:phone},{chatbot_nomor_whatsapp:phone}]}}),0);
  fixturePhones.push(phone);
  const sent = [], errors = [], queries = [], receipts = [], transcript = [];
  const clients = new ClientOutbox(':memory:',{url:'http://localhost/transactional-client-verification',token:'offline-simulation-token',timeoutMs:20000},{
    now:()=>clock,logger:{error:error=>errors.push(error)},
    fetchImpl:async(_url,options)=>{
      const input=JSON.parse(options.body);
      const result=tx?await saveClient(tx,input,clock):{id_klien:'KL0000001',id_agent:'AG108',status:receipts.length?'updated':'created'};
      receipts.push({status:result.status,criteria:input.criteria});
      return Response.json(result);
    },
  });
  const config={transport:'baileys',requirePropertyInquiry:true,replyDelayMs:0,maxSessions:10,maxPending:20,maxPendingPerPhone:10,maxDedup:100,sessionTtlMs:86400000,sessionIdleMs:2700000};
  const store=new MemoryStore(config,()=>clock);
  const processor=new MessageProcessor({config,store,clients,agentId:'AG108',now:()=>clock,
    catalog:{async resolve(text,previousId,criteria){
      if(criteria) queries.push(structuredClone(criteria));
      if(tx){
        const result=await getKnowledge(tx,{text,previousId,criteria},clock);
        return {asset:result.asset,catalog:result.candidates,status:result.status,source:result.source};
      }
      if(!criteria)return {asset:structuredClone(asset),catalog:[],status:'matched',source:'synthetic_fixture'};
      const options=[
        {...asset,id:'9350002',name:'Apartemen sintetis luas tanah 80 m²',category:'APARTEMEN',limit_price:200000000,specifications:{land_area_m2:80,building_area_m2:500,has_building:true}},
        {...asset,id:'9350003',name:'Apartemen sintetis luas tanah 120 m²',category:'APARTEMEN',limit_price:220000000,specifications:{land_area_m2:120,building_area_m2:25,has_building:true}},
        {...asset,id:'9350004',name:'Rumah sintetis luas tanah 160 m²',category:'RUMAH',limit_price:240000000,specifications:{land_area_m2:160,building_area_m2:70,has_building:true}},
      ].map(row=>({...row,price_display:`Rp ${row.limit_price.toLocaleString('id-ID')}`,price_label:'Harga limit lelang',
        auction_at:new Date(clock+4*86400000).toISOString(),detail_url:`https://solusindoaset.com/Lelang/simulasi-${row.id}`}))
        .filter(row=>(!criteria.category||row.category===criteria.category)&&(!criteria.min_land_area_m2||row.specifications.land_area_m2>=criteria.min_land_area_m2)&&
          (!criteria.max_land_area_m2||row.specifications.land_area_m2<=criteria.max_land_area_m2)&&auctionCostEstimate(row).total_execution<=criteria.max_total_budget);
      return {asset:null,catalog:options,status:options.length?'recommendations':'not_found',source:'synthetic_fixture'};
    }},
    checks:{stockResult:()=>null,async enqueue(){return {status:'pending',notification_status:'sent'};}},
    ai:{generate(){assert.fail('Clear linked criteria must not need AI');}},
    whatsapp:{async sendText(_to,text){sent.push(text);return `sim-${sent.length}`;}},
    logger:{error:error=>errors.push(error)},
  });
  async function send(text,record=true){
    clock+=1000;
    const start=sent.length,saves=receipts.length,lookups=queries.length;
    processor.acceptBatch([{id:`input-${++sequence}`,from:phone,type:'text',text,timestamp:clock}]);
    await processor.drain();await clients.flush();
    if(record)transcript.push({user:text,replies:sent.slice(start),searches:queries.slice(lookups),saved:receipts.slice(saves)});
  }
  try{
    const opening=`Halo Jason Christopher Liendo �\n\nSaya tertarik dengan properti lelang berikut, apakah masih tersedia?\n\n� *${asset.name}*\n� ${asset.location}\n� *Rp ${asset.limit_price.toLocaleString('id-ID')}*\n� Kode: ${asset.id}\n\n� Detail lengkap:\n${asset.detail_url}\n\nMohon infonya, terima kasih! �`;
    await send(opening,false);await send('boleh',false);await send('terlalu tinggi');await send('400–500 juta');
    assert.ok(sent.at(-1).endsWith(LINKED_SEARCH_CONFIRMATION));assert.equal(queries.length,0);assert.equal(receipts.length,0);
    for(const text of item.turns)await send(text);
    assert.ok(queries.length>0);assert.ok(receipts.length>0);assert.deepEqual(errors,[]);
    const final=receipts.at(-1).criteria;
    assert.equal(final.category,item.category||asset.category);assert.equal(final.min_land_area_m2,item.land);
    assert.equal(final.city,asset.address.city);assert.equal(final.max_total_budget,item.budget||500000000);
    assert.ok(queries.every(query=>query.exclude_ids.includes(asset.id)));
    let stored=null;
    if(tx){
      const rows=await tx.klien.findMany({where:{chatbot_nomor_whatsapp:phone},select:{id_klien:true,chatbot_kriteria:true,chatbot_budget_min:true,chatbot_budget_max:true,chatbot_luas_tanah_min:true,chatbot_jenis_aset:true}});
      assert.equal(rows.length,1);assert.deepEqual(rows[0].chatbot_kriteria,JSON.parse(JSON.stringify(final)));
      assert.equal(rows[0].chatbot_luas_tanah_min==null?null:Number(rows[0].chatbot_luas_tanah_min),item.land);
      assert.equal(rows[0].chatbot_budget_min==null?null:Number(rows[0].chatbot_budget_min),final.min_total_budget);
      assert.equal(Number(rows[0].chatbot_budget_max),final.max_total_budget);
      const prefs=await tx.preferensiKlien.findMany({where:{id_klien:rows[0].id_klien},select:{loc_kota:true,loc_kelurahan:true,tipe_properti:true,luas_min:true}});
      assert.ok(prefs.length>0);assert.ok(prefs.every(p=>(p.luas_min==null?null:Number(p.luas_min))===item.land));
      stored={client_count:rows.length,preference_count:prefs.length,criteria:rows[0].chatbot_kriteria};
    }
    return {name:item.name,transcript,criteria:final,saves:receipts.length,searches:queries.length,stored};
  }finally{await clients.close();}
}

let rolledBack=false;
try{
  if(liveDatabase){
    const {default:dotenv}=await import('dotenv');dotenv.config({path:[resolve(serviceDirectory,'../../.env.local'),resolve(serviceDirectory,'../../.env')],quiet:true});
    const {PrismaClient}=await import('@prisma/client');db=new PrismaClient({log:[]});
    ({getPropertyKnowledge:getKnowledge}=await import('../../../src/lib/chatbot/property-knowledge.ts'));
    ({captureClientWithinTransaction:saveClient}=await import('../../../src/lib/chatbot/client-capture.ts'));
    const rollback=new Error('SIMULATION_ROLLBACK');
    try{
      await db.$transaction(async tx=>{
        const context=await getKnowledge(tx,{text:`Kode ${propertyId}`});assert.ok(context.asset,'The public listing must be available');
        for(const item of cases)reports.push(await runCase(item,context.asset,tx));
        throw rollback;
      },{maxWait:10000,timeout:120000});
    }catch(error){if(error!==rollback)throw error;rolledBack=true;}
    assert.equal(await db.klien.count({where:{chatbot_nomor_whatsapp:{in:fixturePhones}}}),0);
  }else for(const item of cases)reports.push(await runCase(item,synthetic));
  await mkdir(output,{recursive:true});
  const lines=['# Simulasi kriteria pencarian dari link','',`Mode: ${liveDatabase?'database asli dengan rollback penuh':'fixture sintetis offline'}.`,
    'WhatsApp, AI eksternal, booking, dan antrean stok nyata tidak dipanggil. Data uji klien tidak ditinggalkan di database.',''];
  for(const report of reports){
    lines.push(`## ${report.name}`,'');
    for(const turn of report.transcript){
      lines.push(`**Klien:** ${turn.user}`,'');for(const reply of turn.replies)lines.push(`**Bot:** ${reply}`,'');
      if(turn.searches.length)lines.push(`Pencarian: ${JSON.stringify(turn.searches.at(-1))}`,'');
      if(turn.saved.length)lines.push(`Penyimpanan klien: ${turn.saved.at(-1).status}; ${JSON.stringify(turn.saved.at(-1).criteria)}`,'');
    }
    lines.push(`Validasi: ${report.searches} pencarian; ${report.saves} snapshot klien; ${report.stored?'satu klien di database uji, seluruhnya dibatalkan setelah verifikasi':'transport penyimpanan tiruan'}.`,'');
  }
  await writeFile(join(output,'transkrip.md'),lines.join('\n'));
  await writeFile(join(output,'hasil.json'),JSON.stringify({real_whatsapp_sent:false,external_ai_called:false,real_database:liveDatabase,rolled_back:rolledBack,scenarios:reports},null,2));
  console.log(JSON.stringify({passed:reports.length,real_database:liveDatabase,rolled_back:rolledBack,real_whatsapp_sent:false,external_ai_called:false,output}));
}catch(error){console.error(JSON.stringify({verification:'failed',code:error.code||error.name,message:error instanceof assert.AssertionError?error.message:undefined}));process.exitCode=1;}
finally{await db?.$disconnect();}
