import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { consultationFixture } from './lib/consultation-fixture.js';
const scenarios = [
  ['Lelang: bahasa Jawa sehari-hari, kondisi lalu biaya', 'LELANG', ['bangunane piye, iso mlebu ta?', 'nggih', 'mau viewing besok jam 10']],
  ['Secondary: biaya lalu kondisi dan pengajuan survei', 'SECONDARY', ['Mohon rincian biaya pembeliannya.', 'Iya, jelaskan kondisinya', 'Saya ingin survei besok pukul 10 pagi', 'ya', 'ya']],
  ['Primary: kondisi, biaya, lalu waktu yang disebut secara natural', 'PRIMARY', ['kondisinya gmn ko?', 'boleh', 'gas viewing sabtu jam 11', 'oke gas']],
  ['Sewa: pesan pendek bertahap', 'SEWA', ['mau viewing', 'sesuk', 'jam 1 siang', 'sip', 'biaya sewanya brp?']],
  ['Waktu bertentangan dan slot terisi', 'SECONDARY', ['survey sabtu besok jam 10', 'besok jam 10', 'jam 11 aja', 'setuju']],
];
const parts = ['# Simulasi kondisi aset, rincian biaya, dan appointment\n\nTanggal acuan: Rabu, 21 Oktober 2026, pukul 09.00 WIB. Semua aset, harga, nomor dan booking adalah fixture. Percakapan memakai MessageProcessor dan kebijakan produksi; transport WhatsApp serta database diganti mock. Tidak mengirim pesan atau membuat appointment nyata.\n'];
let turns=0, errors=0, simulated=0;
for(const [title,type,messages] of scenarios){
  const f=consultationFixture(type,title.includes('terisi')?{blocked:['10:00']}:{});
  try{
    for(const text of messages)await f.send(text);
    parts.push(`## ${title}\n\n${f.transcript.map(t=>`**${t.speaker}:**\n\n${t.text}`).join('\n\n')}`);
    turns+=f.transcript.length;errors+=f.errors.length;simulated+=f.bookings.size;
  }finally{f.close();}
}
const destination=resolve(process.argv[2]||'docs/simulasi-kondisi-biaya-survei.md');
writeFileSync(destination,parts.join('\n\n')+'\n');
console.log(JSON.stringify({transcript:destination,scenarios:scenarios.length,turns,errors,simulated_bookings:simulated,real_database_bookings:0,real_messages_sent:0}));
if(errors)process.exitCode=1;
