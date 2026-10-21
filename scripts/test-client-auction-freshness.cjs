const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const ts = require('typescript');
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(__dirname, '..', file); if (!/\.[jt]s$/.test(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require','module','exports',code)(name => {
      if (Object.hasOwn(overrides,name)) return overrides[name];
      if (name.startsWith('@/')) return load('src/'+name.slice(2));
      if (name.startsWith('.')) { const path = resolve(dirname(file),name); return path.includes('/backend/') ? require(path) : load(path); }
      return require(name);
    },module,module.exports);
    return module.exports;
  }
  return load;
}
const NOW = Date.parse('2026-10-21T09:00:00+07:00');
const preference = { maksud:'BELI',tipe_properti:'RUMAH',jenis_transaksi:'LELANG',loc_kota:'Kota Surabaya',loc_provinsi:null,loc_kecamatan:null,loc_kelurahan:null,budget_min:null,budget_max:300000000,luas_min:null,luas_max:null };
const listing = (id,date,type='LELANG') => ({ id_property:BigInt(id),slug:'rumah-contoh',judul:`Rumah ${id}`,jenis_transaksi:type,kategori:'RUMAH',status_tayang:'TERSEDIA',bukan_properti:false,ada_bangunan:true,legalitas:'SHM',
  tanggal_lelang:date?new Date(date):null,tanggal_dibuat:new Date(NOW),tanggal_diupdate:new Date(NOW),harga:195000000,harga_efektif:195000000,harga_promo:null,kota:'Kota Surabaya',alamat_lengkap:`Jalan ${['Anggrek','Bougenvil','Cempaka','Dahlia','Edelweis','Flamboyan'][id-1]}`,gambar:null,luas_tanah:110+id,luas_bangunan:80 });
function matches(row,where) {
  return Object.entries(where).every(([key,c])=>{
    if(key==='AND')return (Array.isArray(c)?c:[c]).every(w=>matches(row,w));
    if(key==='OR')return c.some(w=>matches(row,w));
    const v=row[key]; if(c===null||typeof c!=='object')return v===c;
    if(v==null)return false;
    if(c.in&&!c.in.includes(v)||c.notIn&&c.notIn.includes(v)||c.not!==undefined&&v===c.not)return false;
    if(c.gte!==undefined&&v<c.gte||c.lte!==undefined&&v>c.lte||c.gt!==undefined&&v<=c.gt||c.lt!==undefined&&v>=c.lt)return false;
    if(c.contains&&!String(v).toLowerCase().includes(c.contains.toLowerCase()))return false;
    return true;
  });
}
const stock=[listing(1,'2026-04-21T10:00:00+07:00'),listing(2,'2026-09-20T23:59:59+07:00'),listing(3,'2026-09-21T00:00:00+07:00'),listing(4,'2026-10-15T10:00:00+07:00'),listing(5,'2026-11-01T10:00:00+07:00'),listing(6,null)];
test('client matching applies freshness before its SQL pool limit and shares the same in-memory decision',async()=>{
  const {cariCocok,lolosSemuaGerbang}=loader()('src/lib/klienMatch.ts');let query;
  const db={listing:{findMany:async q=>{query=q;return stock.filter(l=>matches(l,q.where)).slice(0,q.take);}}};
  const result=await cariCocok(db,preference,{now:NOW,maks:1,select:{id_property:true}});
  assert.deepEqual(result.map(l=>String(l.id_property)),['3']);
  assert.equal(query.select.tanggal_lelang,true);assert.equal(query.select.jenis_transaksi,true);
  assert.deepEqual(stock.filter(l=>lolosSemuaGerbang(l,preference,{now:NOW})).map(l=>String(l.id_property)),['3','4','5']);
  for(const longgar of ['budget','lokasi','luas','bentuk'])assert.equal((await cariCocok({listing:{findMany:async()=>[stock[0]]}},preference,{now:NOW,longgar})).length,0);
});
test('CRM asset search omits six-month-old cards while keeping recent past and future auctions',async t=>{
  t.mock.method(Date,'now',()=>NOW);
  const db={klien:{findFirst:async()=>({id_klien:'KL00032',nama:'Klien',nomor_whatsapp:'6280000000001',id_properti_asal:null,preferensi:[{...preference,id_preferensi:1n,id_klien:'KL00032'}]})},
    listing:{findMany:async q=>stock.filter(l=>matches(l,q.where)).slice(0,q.take)},rekomendasiDisingkirkan:{count:async()=>0}};
  const route=loader({'@/lib/prisma':{prisma:db},'next-auth':{getServerSession:async()=>({user:{agentId:'AG108'}})},'@/app/api/auth/[...nextauth]/authOptions':{authOptions:{}},
    '@/lib/klienPengecualian':{muatPengecualian:async()=>new Map(),gabung:()=>[]},'@/lib/klienDekat':{siapkanDekat:async()=>new Map(),dekatUntuk:()=>null}})('src/app/api/dashboard/klien/[id]/rekomendasi/siap/route.ts');
  const response=await route.GET({url:'http://localhost/api/dashboard/klien/KL00032/rekomendasi/siap'},{params:{id:'KL00032'}});
  assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.items.map(l=>l.id_property).sort(),['3','4','5']);assert.equal(data.total,3);
});
test('a cached CRM/email selection is rechecked before draft generation or recording any send',async t=>{
  t.mock.method(Date,'now',()=>NOW);let writes=0;
  const db={klien:{findFirst:async()=>({id_klien:'KL00032',nama:'Klien',nomor_whatsapp:'6280000000001'})},listing:{findMany:async()=>[stock[0]]},$transaction:async()=>{writes++;}};
  const {catatKiriman}=loader({'@/lib/prisma':{prisma:db}})('src/lib/kirimRekomendasi.ts');
  const result=await catatKiriman({agentId:'AG108',idKlien:'KL00032',ids:['1']});
  assert.equal(result.ok,false);assert.equal(result.status,404);assert.match(result.message,/lebih dari satu bulan/);assert.equal(writes,0);
});
