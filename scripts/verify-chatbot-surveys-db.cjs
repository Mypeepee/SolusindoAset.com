// Additive migration plus a full write/read/dedupe/calendar check rolled back.
// Does not call the API, Pusher, or WhatsApp.
require('dotenv').config({ path: ['.env.local','.env'], quiet:true });
const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const file = resolve(__dirname,'../src/lib/chatbot/survey-booking.ts'), moduleOutput={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(createRequire(file),moduleOutput,moduleOutput.exports);
const {chatbotSurveyWithinTransaction,surveyAvailability} = moduleOutput.exports;
const {wibDate}=require('../backend/whatsapp/services/survey_time.js');
const db=new PrismaClient();
const requestId=randomUUID();
let bookingId=null, checked=false;
(async()=>{
  if(process.argv.includes('--apply')){
    await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe('ALTER TABLE public.booking_survei ADD COLUMN IF NOT EXISTS chatbot_request_id varchar(64)');
      await tx.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS booking_survei_chatbot_request_unik ON public.booking_survei (chatbot_request_id)');
    });
    console.log(JSON.stringify({migration:'chatbot_survei',applied:true}));
  }
  try{await db.$transaction(async tx=>{
    const now=Date.now(),agentId='AG108';
    const listing=await tx.listing.findFirst({where:{jenis_transaksi:{in:['PRIMARY','SECONDARY','SEWA']},status_tayang:'TERSEDIA',bukan_properti:false},select:{id_property:true}});
    if(!listing)throw new Error('NO_NON_AUCTION_ASSET');
    let date,time;
    for(let day=1;day<=7;day++){
      const d=wibDate(now+day*86400000),a=await surveyAvailability(tx,agentId,d,now),slot=a.blockedSlots.find(s=>!s.blocked);
      if(slot){date=d;time=slot.label;break;}
    }
    if(!date||!time)throw new Error('NO_AVAILABLE_SURVEY_SLOT');
    const input={action:'book',agent_id:agentId,property_id:String(listing.id_property),date,time,name:'SIMULASI VERIFIKASI ROLLBACK',phone:'6280000000001',request_id:requestId};
    const first=await chatbotSurveyWithinTransaction(tx,input,now),again=await chatbotSurveyWithinTransaction(tx,input,now);
    bookingId=first.booking_id;
    const bookings=await tx.$queryRaw`SELECT id_booking,id_agent,id_property,status FROM public.booking_survei WHERE chatbot_request_id=${requestId}`;
    const events=await tx.acara.findMany({where:{id_agent:agentId,id_property:listing.id_property,deskripsi:{contains:`Booking #${bookingId}.`}},select:{id_agent:true,tipe_acara:true,tanggal_mulai:true}});
    if(!first.created||again.created||again.booking_id!==first.booking_id||bookings.length!==1||events.length!==1||bookings[0].status!=='PENDING'||events[0].tipe_acara!=='SITE_VISIT')throw new Error('SURVEY_VERIFY_FAILED');
    let conflict=false;try{await chatbotSurveyWithinTransaction(tx,{...input,request_id:randomUUID()},now);}catch(error){conflict=error.code==='SURVEY_SLOT_TAKEN';}
    if(!conflict)throw new Error('SLOT_CONFLICT_NOT_BLOCKED');
    checked=true;
    throw new Error('ROLLBACK_SURVEY_VERIFY');
  },{timeout:45000,maxWait:10000});}catch(error){if(error.message!=='ROLLBACK_SURVEY_VERIFY')throw error;}
  const residual=await db.$queryRaw`SELECT count(*)::int AS n FROM public.booking_survei WHERE chatbot_request_id=${requestId}`;
  const events=bookingId?await db.acara.count({where:{deskripsi:{contains:`Booking #${bookingId}.`}}}):0;
  if(!checked||residual[0].n!==0||events!==0)throw new Error('ROLLBACK_CLEANUP_FAILED');
  console.log(JSON.stringify({check:'survey_database',passed:true,booking_write_read:true,calendar_write_read:true,idempotency:true,slot_conflict:true,rollback_clean:true,real_messages_sent:0}));
})().catch(error=>{console.error(JSON.stringify({check:'survey_database',passed:false,code:error.code||error.message||error.name}));process.exitCode=1;}).finally(()=>db.$disconnect());
