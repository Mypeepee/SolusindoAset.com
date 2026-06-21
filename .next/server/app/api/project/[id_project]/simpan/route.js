"use strict";(()=>{var e={id:9639,ids:[9639]};e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},58889:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>f,patchFetch:()=>h,requestAsyncStorage:()=>j,routeModule:()=>g,serverHooks:()=>b,staticGenerationAsyncStorage:()=>E});var r={};a.r(r),a.d(r,{POST:()=>m});var i=a(49303),s=a(88716),n=a(60670),o=a(87070),p=a(53524),c=a(13538);function _(e){if("number"===typeof e)return Number.isFinite(e)?e:0;if("string"===typeof e){const t=e.trim().replace(/,/g,""),a=Number(t);return Number.isFinite(a)?a:0}if(e&&"object"===typeof e){const t="function"===typeof e.toString?e.toString():"",a=Number(t);return Number.isFinite(a)?a:0}return 0}function u(e){const t=_(e);return t<=0?0:t>1?t/100:t}function l(e){return Math.round(100*(Number.isFinite(e)?e:0))/100}function d(e){return Math.round(1e6*(Number.isFinite(e)?e:0))/1e6}async function m(e,t){try{const{id_project:r}=await t.params,i=await e.json(),s=String(i?.id_project||r||"").trim(),n=i?.tanggal_terjual;if(!s)return o.NextResponse.json({success:!1,message:"id_project wajib ada."},{status:400});if("string"!==typeof(a=n)||!/^\d{4}-\d{2}-\d{2}$/.test(a))return o.NextResponse.json({success:!1,message:"tanggal_terjual wajib format YYYY-MM-DD."},{status:400});const m=(await c._.$queryRaw(p.Prisma.sql`
        SELECT
          p.id_project,
          p.id_listing,
          p.mulai_tanggal
        FROM public.project p
        WHERE p.id_project = ${s}
        LIMIT 1
      `))[0];if(!m)return o.NextResponse.json({success:!1,message:"Project tidak ditemukan."},{status:404});if(!m.id_listing)return o.NextResponse.json({success:!1,message:"id_listing pada project tidak ditemukan."},{status:400});const g=await c._.$queryRaw(p.Prisma.sql`
        SELECT
          pi.id_agent,
          pi.nominal_komitmen,
          pi.persentase_kepemilikan,
          pi.status
        FROM public.project_investor pi
        WHERE pi.id_project = ${s}
        ORDER BY pi.id_project_investor ASC
      `);if(!g.length)return o.NextResponse.json({success:!1,message:"Data investor project tidak ditemukan di tabel project_investor."},{status:400});const j=l(_(i?.harga_jual)),E=l(_(i?.total_biaya_akuisisi)),b=l(_(i?.profit_kotor)),f=d(_(i?.pph_percent)),h=d(_(i?.ajb_percent)),D=d(_(i?.agent_fee_percent)),k=l(_(i?.total_biaya_transaksi)),$=l(_(i?.profit_bersih)),y=d(_(i?.roi_bersih_percent)),R=Math.max(0,Math.floor(_(i?.durasi_hari))),w=g.map((e=>({id_agent:String(e.id_agent||"").trim(),modal:l(_(e.nominal_komitmen)),percent_raw:u(e.persentase_kepemilikan),status:String(e.status||"").trim()}))),N=w.reduce(((e,t)=>e+t.percent_raw),0),v=w.reduce(((e,t)=>e+t.modal),0),x=w.map((e=>{let t=0;N>0?t=e.percent_raw/N:v>0&&(t=e.modal/v);const a=l($*t),r=l(e.modal+a);return{id_agent:e.id_agent,modal:l(e.modal),porsi_percent:d(100*t),profit:a,total_diterima:r}}));return await c._.$transaction((async e=>{await e.$executeRaw(p.Prisma.sql`
        INSERT INTO public.project_selesai (
          id_project,
          id_listing,
          tanggal_pembelian,
          tanggal_terjual,
          durasi_hari,
          harga_jual,
          total_biaya_akuisisi,
          profit_kotor,
          pph_percent,
          ajb_percent,
          agent_fee_percent,
          total_biaya_transaksi,
          profit_bersih,
          roi_bersih,
          dibuat_tanggal,
          diupdate_tanggal
        )
        VALUES (
          ${s},
          ${m.id_listing},
          ${m.mulai_tanggal},
          ${n}::date,
          ${R},
          ${j},
          ${E},
          ${b},
          ${f},
          ${h},
          ${D},
          ${k},
          ${$},
          ${y},
          NOW(),
          NOW()
        )
        ON CONFLICT (id_project)
        DO UPDATE SET
          id_listing = EXCLUDED.id_listing,
          tanggal_pembelian = EXCLUDED.tanggal_pembelian,
          tanggal_terjual = EXCLUDED.tanggal_terjual,
          durasi_hari = EXCLUDED.durasi_hari,
          harga_jual = EXCLUDED.harga_jual,
          total_biaya_akuisisi = EXCLUDED.total_biaya_akuisisi,
          profit_kotor = EXCLUDED.profit_kotor,
          pph_percent = EXCLUDED.pph_percent,
          ajb_percent = EXCLUDED.ajb_percent,
          agent_fee_percent = EXCLUDED.agent_fee_percent,
          total_biaya_transaksi = EXCLUDED.total_biaya_transaksi,
          profit_bersih = EXCLUDED.profit_bersih,
          roi_bersih = EXCLUDED.roi_bersih,
          diupdate_tanggal = NOW()
      `),await e.$executeRaw(p.Prisma.sql`
        DELETE FROM public.project_selesai_investor
        WHERE id_project = ${s}
      `);for(const t of x)await e.$executeRaw(p.Prisma.sql`
          INSERT INTO public.project_selesai_investor (
            id_project,
            id_agent,
            modal,
            porsi_percent,
            profit,
            total_diterima
          )
          VALUES (
            ${s},
            ${t.id_agent},
            ${t.modal},
            ${t.porsi_percent},
            ${t.profit},
            ${t.total_diterima}
          )
        `)})),o.NextResponse.json({success:!0,message:"Data project selesai dan distribusi investor berhasil disimpan.",data:{investor_tersimpan:x.length,distribusi:x}})}catch(r){return console.error("POST /api/project/[id_project]/simpan error:",r),o.NextResponse.json({success:!1,message:"Gagal menyimpan data project selesai.",error:r instanceof Error?r.message:"Unknown error"},{status:500})}var a}const g=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/project/[id_project]/simpan/route",pathname:"/api/project/[id_project]/simpan",filename:"route",bundlePath:"app/api/project/[id_project]/simpan/route"},resolvedPagePath:"/Users/jasnc/Downloads/Important/kosku/src/app/api/project/[id_project]/simpan/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:j,staticGenerationAsyncStorage:E,serverHooks:b}=g,f="/api/project/[id_project]/simpan/route";function h(){return(0,n.patchFetch)({serverHooks:b,staticGenerationAsyncStorage:E})}},13538:(e,t,a)=>{a.d(t,{Z:()=>s,_:()=>i});var r=a(53524);const i=global.prisma||new r.PrismaClient({log:["query"]});const s=i}};var t=require("../../../../../webpack-runtime.js");t.C(e);var a=t.X(0,[8948,5972],(()=>{return e=58889,t(t.s=e);var e}));module.exports=a})();