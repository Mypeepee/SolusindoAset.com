/** Shared artwork for the first Instagram slide and the single WhatsApp poster. */
export type PropertyCover = {
  brand: string;
  title: string;
  location: string;
  category: string;
  photo: string;
  photos?: string[];
  logo?: string;
  price?: string;
  priceLabel?: string;
  facts?: string[];
  specifications?: { label: string; value: string }[];
  contact?: string;
  listingUrl?: string;
  qrImage?: string;
  fontData?: string;
  story?: boolean;
  sample?: boolean;
};

const html = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function propertyCoverHtml(input: PropertyCover) {
  const photos = [
    ...new Set([input.photo, ...(input.photos || [])].filter(Boolean)),
  ].slice(0, 3);
  const specifications =
    input.specifications ||
    (input.facts?.length
      ? [{ label: input.facts[0], value: input.facts.slice(1).join(" · ") }]
      : []);
  const hasQr = Boolean(input.qrImage && input.listingUrl && !input.sample);
  let hostname = "";
  try {
    hostname = new URL(input.listingUrl || "").hostname;
  } catch {}
  return `<!doctype html><html lang="id"><meta charset="utf-8"><style>
  ${input.fontData ? `@font-face{font-family:Cover;src:url(data:font/ttf;base64,${input.fontData}) format("truetype");font-weight:100 900;font-display:block}` : ""}
  *{box-sizing:border-box}body{margin:0;font-family:Cover,Arial,sans-serif;color:#0D1B2A}
  .story-frame{--navy:#0D1B2A;--cream:#F7F4EC;--red:#8B1A1A;--gold:#CE982A;width:1080px;height:${input.story ? 1920 : 1350}px;background:var(--cream);display:flex;flex-direction:column;overflow:hidden}
  .brand{flex:none;min-height:102px;padding:24px 40px;background:var(--navy);color:white;display:flex;align-items:center;justify-content:space-between;gap:24px}
  .brand-name{display:flex;align-items:center;gap:18px;min-width:0;font-size:27px;line-height:1.25;font-weight:800;text-transform:uppercase;letter-spacing:.5px}.brand-name span{overflow-wrap:anywhere}.brand-mark{width:48px;height:48px;object-fit:contain;flex:none}
  .category{flex:none;max-width:240px;border-radius:40px;background:var(--gold);padding:13px 22px;font-size:20px;font-weight:800;letter-spacing:1px;text-transform:uppercase;text-align:center}
  .collage{flex:1;min-height:300px;display:grid;grid-template-columns:1.6fr 1fr;grid-template-rows:1fr 1fr;gap:6px;background:var(--navy);overflow:hidden}.photo-wrap{position:relative;min-width:0;min-height:0;overflow:hidden}.photo-wrap:first-child{grid-row:1 / -1}.collage[data-count="1"]{grid-template-columns:1fr}.collage[data-count="2"] .photo-wrap:last-child{grid-row:1 / -1}.photo{position:absolute;width:100%;height:100%;inset:0;object-fit:cover}
  .headline{flex:none;min-height:116px;display:grid;align-content:center;background:var(--red);padding:22px 40px;color:#FFF9ED;text-align:center}h1{font-size:40px;line-height:1.22;letter-spacing:-1px;font-weight:800;margin:0;overflow-wrap:anywhere;max-height:150px;overflow:hidden}
  .information{flex:none;padding:24px 40px;display:grid;gap:16px}.section-line{display:flex;justify-content:space-between;align-items:center;gap:20px;font-size:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--red)}.section-line span:last-child{color:var(--navy);background:var(--gold);border-radius:8px;padding:9px 15px;font-size:14px;white-space:nowrap}
  .address{padding:17px 22px;background:#FFFDFA;border:1px solid #DED5BF;border-radius:18px}.label{font-size:15px;line-height:1.4;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;color:#68645D}.address-value{font-size:25px;line-height:1.35;font-weight:750;margin-top:5px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .specifications{display:flex;gap:16px}.specification{flex:1;min-width:0;border:1px solid #DED5BF;background:#FFFDFA;border-radius:18px;overflow:hidden}.specification .label{padding:9px 20px;background:var(--gold);color:var(--navy);font-size:14px}.specification:nth-child(even) .label{background:var(--navy);color:#E8B854}.spec-value{padding:12px 20px;font-size:31px;line-height:1.15;font-weight:800;overflow-wrap:anywhere;color:var(--red)}.specification:nth-child(even) .spec-value{color:var(--navy)}
  .ticket{display:flex;align-items:center;gap:24px;padding:23px 28px;border:2px solid #B47722;border-radius:22px;background:var(--red);color:#FFF4D5}.price-block{flex:1;min-width:0}.ticket .label{color:#F2CD79}.price{font-size:48px;line-height:1.15;letter-spacing:-1.5px;font-weight:800;white-space:nowrap;margin-top:9px}.ticket-note{font-size:17px;line-height:1.45;margin-top:12px;color:#FFF0D4}.qr{flex:none;width:170px;border-left:2px dashed #D5AD73;padding-left:22px;text-align:center}.qr img{display:block;width:145px;height:145px;border-radius:10px}.qr-label{font-size:12px;font-weight:800;line-height:1.5;letter-spacing:1px;margin-top:8px;text-transform:uppercase}
  .footer{flex:none;min-height:112px;background:var(--navy);color:var(--cream);padding:22px 40px;display:flex;align-items:center;justify-content:space-between;gap:24px}.footer .label{color:#E7B64C;font-size:14px}.contact{font-size:25px;font-weight:800;line-height:1.3;margin-top:5px;overflow-wrap:anywhere}.destination{min-width:0;max-width:48%;text-align:right}.destination strong{display:block;font-size:22px;line-height:1.35;color:#E7B64C}.destination small{display:block;font-size:15px;line-height:1.5;margin-top:6px;overflow-wrap:anywhere}
  .story .brand{min-height:192px;padding-top:112px}.story .headline{min-height:144px;padding:27px 40px}.story h1{font-size:46px;max-height:174px}.story .information{padding:32px 40px;gap:22px}.story .address{padding:23px}.story .address-value{font-size:29px}.story .spec-value{font-size:39px;padding:18px 20px}.story .ticket{padding:30px}.story .price{font-size:58px}.story .ticket-note{font-size:20px}.story .qr{width:202px}.story .qr img{width:176px;height:176px}.story .footer{min-height:218px;padding-bottom:112px}
  </style><main class="story-frame${input.story ? " story" : ""}">
  <header class="brand"><div class="brand-name">${input.logo ? `<img class="brand-mark" src="${html(input.logo)}" alt="">` : ""}<span>${html(input.brand)}</span></div><span class="category">${html(input.category)}</span></header>
  <div class="collage" data-count="${photos.length}">${photos.map((photo, i) => `<div class="photo-wrap"><img class="photo" src="${html(photo)}" alt="Foto properti ${i + 1}"></div>`).join("")}</div>
  <section class="headline"><h1>${html(input.title)}</h1></section>
  <section class="information"><div class="section-line"><span>Informasi properti</span><span>${input.story ? "Lihat detail properti" : "Foto detail di slide berikutnya"}</span></div>
  <div class="address"><div class="label">Alamat properti</div><div class="address-value">${html(input.location)}</div></div>
  ${specifications.length ? `<div class="specifications">${specifications.map((spec) => `<div class="specification"><div class="label">${html(spec.label)}</div><div class="spec-value">${html(spec.value)}</div></div>`).join("")}</div>` : ""}
  <div class="ticket"><div class="price-block"><div class="label">${html(input.price ? input.priceLabel || "Harga penawaran" : "Kenali propertinya")}</div><div class="price">${html(input.price || "Lihat lebih dekat")}</div><div class="ticket-note">${html(input.sample ? "CONTOH DESAIN · BUKAN PENAWARAN AKTIF" : (input.facts || []).join(" · ") || "Diskusikan kebutuhan properti Anda bersama kami.")}</div></div>${hasQr ? `<div class="qr"><img src="${html(input.qrImage!)}" alt="QR detail properti"><div class="qr-label">Scan untuk<br>detail properti</div></div>` : ""}</div></section>
  <footer class="footer"><div><div class="label">${input.sample ? "Contoh materi pemasaran" : "Hubungi tim kami"}</div><div class="contact">${html(input.contact || input.brand)}</div></div><div class="destination"><strong>${input.story ? "Kenali propertinya." : "Geser. Lihat. Rencanakan."}</strong><small>${html(input.sample ? "Contoh desain, bukan listing aktif." : hostname || "Informasi & ketersediaan melalui tim kami")}</small></div></footer></main></html>`;
}
