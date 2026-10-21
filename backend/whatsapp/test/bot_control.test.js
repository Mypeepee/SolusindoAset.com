import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBotControlCommand, DEFAULT_BOT_CONTROL_PHONE as CONTROL } from '../services/bot_control.js';
import { MessageProcessor } from '../services/message_processor.js';
import { MemoryStore } from '../state/memory_store.js';
import { ConversationControl } from '../state/conversation_control.js';
import { loadConfig } from '../config.js';

const NOW = Date.parse('2026-10-21T10:00:00+07:00'), PHONE = '6281234567890', OTHER = '6281111111111', LID = 'lid:99123456';
const QUERY = 'Carikan rumah lelang di Surabaya budget 300 juta luas tanah bebas';
function fixture(t) {
  let now = NOW, seq = 0;
  const controls = new ConversationControl(':memory:', () => now); t.after(() => controls.close());
  const control = controls.forTenant('AG1'), replies = [], acknowledgements = [], errors = [];
  const config = { transport:'baileys',botControlPhone:CONTROL,stokerPhone:'6285707379606',manualReplyPauseMs:300000,replyDelayMs:0,
    maxSessions:100,maxPending:100,maxPendingPerPhone:20,maxDedup:1000,sessionTtlMs:86400000 };
  const whatsapp = { getStatus:()=>({connected:true,phone:'6289999999999'}),getContactPhone:p=>p===LID?PHONE:p,getContactAliases:p=>[PHONE,LID].includes(p)?[PHONE,LID]:[p],
    async sendText(to,text){replies.push({to,text});return `sent-${replies.length}`;},
    async acknowledgeControlCommand(message,text){acknowledgements.push({to:message.from,text});} };
  const build = (tenant = 'AG1') => new MessageProcessor({config,store:new MemoryStore(config,()=>now,controls.forTenant(tenant)),whatsapp,agentId:tenant,now:()=>now,
    catalog:{async resolve(){return {status:'not_found',asset:null,catalog:[],source:'database_listing_publik'};}},ai:{generate(){assert.fail('Control commands must never call the LLM');}},
    logger:{error(e){errors.push(e);}} });
  let processor=build();
  const message=(text,from=CONTROL,type='human_takeover',extra={})=>({id:`in-${++seq}`,whatsapp_id:`owner-${seq}`,from,type,text,timestamp:now,...extra});
  return {control,controls,config,replies,acknowledgements,errors,build,message,get processor(){return processor;},
    advance(ms){now+=ms;},restart(){processor=build();},
    async owner(text,from=CONTROL,extra={}){const m=message(text,from,'human_takeover',extra);processor.acceptBatch([m]);await processor.drain();return m;},
    async client(text=QUERY,from=PHONE){processor.acceptBatch([message(text,from,'text')]);await processor.drain();},
  };
}
for (const [text,command,target] of [
  [`#boton ${PHONE}`,'on',PHONE],[`#botoff ${PHONE}`,'off',PHONE],['#BOT OFF +62 812-3456-7890','off',PHONE],['#boton 081234567890','on',PHONE],
]) test(`parse central command: ${text}`,()=>assert.deepEqual(parseBotControlCommand(text),{command,target}));
for (const text of ['#boton','#botoff abc','#boton 123','#boton 6288888888888888',`#boton ${PHONE},${OTHER}`])
  test(`reject invalid central target: ${text}`,()=>assert.equal(parseBotControlCommand(text)?.error,'INVALID_TARGET'));

test('off sent to the control contact pins only its target beyond the automatic manual-pause deadline',async t=>{
  const f=fixture(t);f.processor.store.create(OTHER);
  await f.owner('Saya bantu jawab',PHONE);assert.ok(f.control.get(PHONE).resume_at);
  await f.owner(`#botoff ${PHONE}`);assert.equal(f.control.get(PHONE).resume_at,undefined);
  f.advance(60000);await f.owner('Saya lanjut bantu jawab',PHONE);assert.equal(f.control.get(PHONE).resume_at,undefined);
  f.advance(3600000);f.processor.flushManualPauses();await f.client();
  assert.equal(f.processor.store.get(PHONE).is_bot_active,false);assert.equal(f.processor.store.get(OTHER).is_bot_active,true);
  assert.equal(f.replies.length,0);assert.equal(f.processor.store.get(CONTROL),undefined);
  assert.equal(f.acknowledgements.at(-1).to,CONTROL);assert.match(f.acknowledgements.at(-1).text,/dijeda tanpa batas waktu/);assert.deepEqual(f.errors,[]);
});
test('on resumes the latest pending client query once after restart and keeps other clients paused',async t=>{
  const f=fixture(t);await f.owner(`#botoff ${PHONE}`);await f.owner(`#botoff ${OTHER}`);
  f.restart();await f.client();assert.equal(f.replies.length,0);
  f.advance(2000);const on=await f.owner(`#boton ${PHONE}`);
  assert.equal(f.replies.length,1);assert.equal(f.replies[0].to,PHONE);assert.equal(f.processor.store.get(PHONE).is_bot_active,true);assert.equal(f.control.get(OTHER).resume_at,undefined);
  f.processor.acceptBatch([on]);await f.processor.drain();assert.equal(f.replies.length,1);
  assert.match(f.acknowledgements.at(-1).text,/diaktifkan kembali/);assert.deepEqual(f.errors,[]);
});
test('phone commands reach a client whose active session uses a WhatsApp LID',async t=>{
  const f=fixture(t);f.processor.store.create(LID);await f.owner(`#botoff ${PHONE}`);
  assert.equal(f.processor.store.get(LID).is_bot_active,false);assert.equal(f.control.get(LID).resume_at,undefined);
  f.advance(2000);await f.owner(`#boton ${PHONE}`);assert.equal(f.processor.store.get(LID).is_bot_active,true);assert.equal(f.control.get(LID),undefined);
});
test('client text, incoming control-contact text and a command sent to another chat cannot control the target',async t=>{
  const f=fixture(t);await f.owner(`#botoff ${PHONE}`);await f.client(`#boton ${PHONE}`);await f.client(`#boton ${PHONE}`,CONTROL);
  assert.equal(f.processor.store.get(PHONE).is_bot_active,false);assert.equal(f.acknowledgements.length,1);
  await f.owner(`#boton ${PHONE}`,OTHER);assert.equal(f.processor.store.get(PHONE).is_bot_active,false);
  assert.equal(f.acknowledgements.length,1);
});
test('invalid or operational targets produce help in the control chat without modifying a client',async t=>{
  const f=fixture(t);f.processor.store.create(PHONE);
  for(const command of ['#botoff',`#boton ${CONTROL}`,'#boton 6285707379606','#boton 6289999999999'])await f.owner(command);
  assert.equal(f.processor.store.get(PHONE).is_bot_active,true);assert.equal(f.control.list().length,0);assert.equal(f.replies.length,0);
  assert.equal(f.acknowledgements.length,4);assert.ok(f.acknowledgements.every(a=>a.to===CONTROL));
});
test('control state and deduplication are isolated to the paired agent',async t=>{
  const f=fixture(t),other=f.build('AG2');other.store.create(PHONE);await f.owner(`#botoff ${PHONE}`);
  assert.equal(other.store.get(PHONE).is_bot_active,true);assert.equal(f.controls.forTenant('AG2').get(PHONE),undefined);
});
test('old commands and replayed IDs cannot undo a newer pause after restart',async t=>{
  const f=fixture(t);const first=await f.owner(`#botoff ${PHONE}`);f.advance(2000);const on=await f.owner(`#boton ${PHONE}`);
  f.advance(2000);await f.owner(`#botoff ${PHONE}`);f.restart();
  f.processor.acceptBatch([on,{...on,id:'different-id',whatsapp_id:'out-of-order-id'},first]);await f.processor.drain();
  assert.equal(f.control.get(PHONE).resume_at,undefined);assert.equal(f.acknowledgements.length,3);
});
test('control number is configured independently of the stoker number',()=>{
  const env={LLM_PROVIDER:'gemini',LLM_MODEL:'test',GEMINI_API_KEY:'fake',ADMIN_API_TOKEN:'a'.repeat(32)};
  assert.equal(loadConfig(env).botControlPhone,CONTROL);assert.equal(loadConfig(env).stokerPhone,'6285707379606');
  assert.throws(()=>loadConfig({...env,BOT_CONTROL_WHATSAPP_NUMBER:'oops'}),/BOT_CONTROL_WHATSAPP_NUMBER/);
  assert.throws(()=>loadConfig({...env,BOT_CONTROL_WHATSAPP_NUMBER:'6285707379606'}),/berbeda/);
});
