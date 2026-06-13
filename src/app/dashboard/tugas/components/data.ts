import { toast } from "sonner";
import { openWA } from "./helpers";
import type { DailyTask } from "./types";

export function buildDailyTasks(
  mark: (id: string) => void,
  incr: (id: string) => void,
  openCatalog: () => void,
): DailyTask[] {
  return [
    /* URGENT */
    { id:"u1", category:"URGENT", overdue:true, done:false,
      title:"Follow-up Bapak Hendra — belum dihubungi 45 menit lalu",
      why:"Lead HOT di tahap Negosiasi. Diam > 24 jam = 60% probabilitas closing turun.",
      leadName:"Bapak Hendra", leadTemp:"HOT", leadPhone:"08123456789",
      pipelineStage:"Negosiasi", commissionValue:36_000_000,
      actions:[
        { label:"WA Sekarang", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08123456789","Bapak Hendra","Halo Pak Hendra, saya dari Solusindo. Bagaimana keputusannya untuk penawaran Rp 3,5M? 🙏") },
        { label:"Telepon", icon:"solar:phone-bold", variant:"sky",
          onClick:()=>window.open("tel:08123456789") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("u1") },
      ]},
    { id:"u2", category:"URGENT", overdue:true, done:false,
      title:"Kirim draft PPJB ke Notaris Budi hari ini",
      why:"Kavling Graha Family sudah deal — dokumen harus masuk hari ini agar tidak molor.",
      propertyTitle:"Kavling Graha Family", commissionValue:28_500_000,
      actions:[
        { label:"Buka Dokumen", icon:"solar:document-text-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka halaman Surat & Dokumen...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("u2") },
      ]},

    /* KONTEN */
    { id:"k1", category:"KONTEN", done:false,
      title:"Post listing Apartemen Ciputra World di Instagram & TikTok",
      why:"203 views 7 hari — trafik tertinggi. Konten pagi mendapat engagement 2x lebih tinggi.",
      propertyTitle:"Apartemen Ciputra World 2BR",
      actions:[
        { label:"Lihat Katalog Top 15", icon:"solar:star-bold-duotone", variant:"amber",
          onClick:()=>openCatalog() },
        { label:"Buat Konten", icon:"solar:gallery-add-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka content creator...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("k1") },
      ]},
    { id:"k2", category:"KONTEN", done:false,
      title:"Post listing Rumah Citraland Golf di Facebook & marketplace",
      why:"Potential score 94 — listing terbaik kamu. Upload ulang dengan foto baru agar algoritma mendorong.",
      propertyTitle:"Rumah Citraland Golf",
      actions:[
        { label:"Lihat Katalog", icon:"solar:star-bold-duotone", variant:"amber",
          onClick:()=>openCatalog() },
        { label:"Buat Konten", icon:"solar:gallery-add-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka content creator...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("k2") },
      ]},
    { id:"k3", category:"KONTEN", done:false,
      title:"Post 1 konten edukasi: '5 Tips Negosiasi Harga Properti'",
      why:"Konten edukatif membangun trust & positioning sebagai expert. Engagement rata-rata 3x lebih tinggi dari listing biasa.",
      actions:[
        { label:"Buat Konten", icon:"solar:gallery-add-bold-duotone", variant:"violet",
          onClick:()=>toast("Membuka content creator...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("k3") },
      ]},

    /* FOLLOWUP */
    { id:"f1", category:"FOLLOWUP", done:false, scheduledAt:"14:00",
      title:"Konfirmasi site visit Ibu Ratna — Town House Pakuwon (sore ini)",
      why:"HOT lead, viewing ke-3. Konfirmasi sekarang mencegah no-show dan menunjukkan profesionalisme.",
      leadName:"Ibu Ratna", leadTemp:"HOT", leadPhone:"08234567890",
      pipelineStage:"Viewing", commissionValue:52_000_000,
      actions:[
        { label:"WA Konfirmasi", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08234567890","Ibu Ratna","Halo Bu Ratna, mengingatkan site visit Town House Pakuwon hari ini jam 14:00. Kami sudah siapkan semua. Sampai jumpa! 🏡") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f1") },
      ]},
    { id:"f2", category:"FOLLOWUP", done:false,
      title:"Follow-up Mbak Sari — negosiasi final, tunggu keputusan 5 hari",
      why:"Semakin lama di stage Negosiasi, semakin dingin. Hubungi hari ini atau deal bisa gagal.",
      leadName:"Mbak Sari", leadTemp:"HOT", leadPhone:"08456789012",
      pipelineStage:"Negosiasi", commissionValue:24_750_000,
      actions:[
        { label:"WA", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08456789012","Mbak Sari","Halo Mbak Sari, bagaimana pertimbangannya untuk Ruko HR Muhammad? Ada yang bisa saya bantu? 😊") },
        { label:"Telepon", icon:"solar:phone-bold", variant:"sky",
          onClick:()=>window.open("tel:08456789012") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f2") },
      ]},
    { id:"f3", category:"FOLLOWUP", done:false,
      title:"Follow-up Mas Rizky — qualified buyer, belum dijawab kemarin",
      why:"Buyer yang tidak di-follow-up dalam 48 jam biasanya pergi ke agen lain.",
      leadName:"Mas Rizky", leadTemp:"WARM", leadPhone:"08345678901",
      pipelineStage:"Qualified", commissionValue:19_000_000,
      actions:[
        { label:"WA", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08345678901","Mas Rizky","Halo Mas Rizky, ada update untuk Apartemen Ciputra World yang cocok untuk investasi 🏢") },
        { label:"Telepon", icon:"solar:phone-bold", variant:"sky",
          onClick:()=>window.open("tel:08345678901") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f3") },
      ]},
    { id:"f4", category:"FOLLOWUP", done:false, target:5, current:1,
      title:"Hubungi 5 prospek baru dari database hari ini",
      why:"Top agent melakukan minimal 5 outreach baru per hari. Ini adalah fondasi pipeline masa depan.",
      actions:[
        { label:"+1 Dihubungi", icon:"solar:user-plus-bold-duotone", variant:"sky",
          onClick:()=>incr("f4") },
        { label:"Buka Database", icon:"solar:users-group-rounded-bold", variant:"ghost",
          onClick:()=>toast("Membuka database client...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("f4") },
      ]},

    /* VIEWING */
    { id:"v1", category:"VIEWING", done:false, scheduledAt:"14:00",
      title:"Site visit bersama Ibu Ratna — Town House Pakuwon City",
      why:"Viewing ke-3. Siapkan info AJB, biaya notaris, dan simulasi KPR. Ini bisa langsung closing.",
      leadName:"Ibu Ratna", leadTemp:"HOT", propertyTitle:"Town House Pakuwon City", commissionValue:52_000_000,
      actions:[
        { label:"Buka di Maps", icon:"solar:map-point-bold-duotone", variant:"amber",
          onClick:()=>window.open("https://maps.google.com?q=Pakuwon+City+Surabaya","_blank") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("v1") },
      ]},
    { id:"v2", category:"VIEWING", done:false,
      title:"After-visit follow-up — kirim summary properti ke lead kemarin",
      why:"24 jam setelah viewing adalah golden window. Kirim info sebelum mereka bandingkan ke properti lain.",
      actions:[
        { label:"Buat & Kirim WA", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>toast("Membuka template after-visit follow-up...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("v2") },
      ]},

    /* PIPELINE */
    { id:"p1", category:"PIPELINE", done:false,
      title:"Update status Bapak Hendra di pipeline",
      why:"Pipeline yang tidak diupdate = blind spot. Kamu tidak tahu deal mana yang butuh perhatian sekarang.",
      leadName:"Bapak Hendra", leadTemp:"HOT", pipelineStage:"Negosiasi",
      actions:[
        { label:"Buka Pipeline", icon:"solar:square-transfer-horizontal-bold", variant:"primary",
          onClick:()=>toast("Membuka pipeline view...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"ghost", onClick:()=>mark("p1") },
      ]},
    { id:"p2", category:"PIPELINE", done:false, target:2, current:0,
      title:"Update foto & deskripsi 2 listing yang >7 hari tidak diperbarui",
      why:"Portal properti mendeprioritaskan listing lama. Update rutin = lebih banyak organic traffic.",
      actions:[
        { label:"+1 Diupdate", icon:"solar:add-circle-bold", variant:"primary",
          onClick:()=>incr("p2") },
        { label:"Buka Listing", icon:"solar:buildings-3-bold-duotone", variant:"ghost",
          onClick:()=>toast("Membuka halaman listings...") },
      ]},

    /* NETWORKING */
    { id:"n1", category:"NETWORKING", done:false, target:2, current:0,
      title:"Hubungi 2 agen lain untuk co-broke Gudang Rungkut Industri",
      why:"Co-broke memperluas jangkauan listing 3x. Komisi bisa dibagi tapi tetap besar.",
      propertyTitle:"Gudang Rungkut Industri",
      actions:[
        { label:"+1 Agen Dihubungi", icon:"solar:add-circle-bold", variant:"pink",
          onClick:()=>incr("n1") },
        { label:"Buka Network", icon:"solar:users-group-rounded-bold-duotone", variant:"ghost",
          onClick:()=>toast("Membuka network agen...") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("n1") },
      ]},
    { id:"n2", category:"NETWORKING", done:false,
      title:"Minta 1 referral dari Pak Didik (client yang sudah closing)",
      why:"Referral dari satisfied client adalah lead paling hangat dan paling murah.",
      leadName:"Pak Didik Santoso", leadPhone:"08567890123",
      actions:[
        { label:"WA Pak Didik", icon:"logos:whatsapp-icon", variant:"green",
          onClick:()=>openWA("08567890123","Pak Didik","Halo Pak Didik, semoga gudang barunya berjalan lancar 🏭 Kalau ada kenalan yang cari properti, boleh referensikan ke saya ya? 🙏") },
        { label:"Tandai Selesai", icon:"solar:check-circle-bold", variant:"primary", onClick:()=>mark("n2") },
      ]},
  ];
}
