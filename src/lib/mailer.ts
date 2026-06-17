// src/lib/mailer.ts
// ---------------------------------------------------------------------------
// Pengirim email via Gmail SMTP (App Password) memakai nodemailer.
//
// Cara setup (1x saja):
//  1) Login ke Gmail yang dipakai (mis. closingsystem@gmail.com)
//  2) Aktifkan 2-Step Verification:  https://myaccount.google.com/security
//  3) Buat App Password:             https://myaccount.google.com/apppasswords
//     -> pilih "Mail", salin 16 huruf yang muncul.
//  4) Isi .env:
//        GMAIL_USER="closingsystem@gmail.com"
//        GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"   (spasi boleh, otomatis dibuang)
//
// Bila env belum diisi, sistem TIDAK error — OTP hanya dicatat di console
// (mode pengembangan) sehingga alur tetap bisa diuji. Cukup isi env saat siap
// kirim email sungguhan, tanpa mengubah kode.
// ---------------------------------------------------------------------------

import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const BRAND = "Solusindo Aset";
const LEGAL = "PT. Solusi Tangguh Rejeki";
const SUPPORT_EMAIL = "closingsystem@gmail.com";
const SITE = "SolusindoAset.com";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://solusindoaset.com";
const ADDRESS =
  "Santorini Town Square, Jl. Ronggolawe No.2A, DR. Soetomo, Kec. Tegalsari, Surabaya, Jawa Timur";

export function isMailConfigured() {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

let cachedTransport: nodemailer.Transporter | null = null;
function getTransport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  return cachedTransport;
}

function otpEmailHtml(otp: string) {
  const year = new Date().getFullYear();
  // Templat email tahan banting untuk berbagai email client (table + inline
  // style + fallback warna solid untuk Outlook). Tema emerald dark, premium.
  return `<!doctype html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark light">
  <meta name="supported-color-schemes" content="dark light">
  <title>${BRAND} — Kode Verifikasi</title>
  <!--[if mso]><style>*{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#04100B;-webkit-font-smoothing:antialiased;">
  <!-- preheader (teks preview tersembunyi) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;mso-hide:all;">
    Kode verifikasi sekali pakai Anda berlaku 10 menit. Jangan bagikan kepada siapa pun.&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#04100B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#0a1a12;background-image:linear-gradient(165deg,#0c2018 0%,#071611 58%,#0a1a12 100%);border:1px solid rgba(16,185,129,0.18);border-radius:24px;overflow:hidden;">

          <!-- accent bar -->
          <tr><td bgcolor="#10b981" height="5" style="height:5px;line-height:5px;font-size:0;background-color:#10b981;background-image:linear-gradient(90deg,#34d399,#10b981,#2dd4bf);">&nbsp;</td></tr>

          <!-- brand header -->
          <tr><td align="center" style="padding:38px 40px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle" width="56" style="width:56px;">
                <div style="width:54px;height:54px;line-height:54px;text-align:center;border-radius:16px;background-color:#0f2a1e;background-image:linear-gradient(145deg,rgba(16,185,129,0.28),rgba(16,185,129,0.04));border:1px solid rgba(16,185,129,0.35);font-size:25px;">🛡️</div>
              </td>
              <td width="14" style="width:14px;">&nbsp;</td>
              <td valign="middle" align="left">
                <div style="font-size:18px;font-weight:800;color:#ffffff;line-height:1.1;letter-spacing:0.2px;">Solusindo <span style="color:#99E39E;">Aset</span></div>
                <div style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:4px;">Property &amp; Asset Platform</div>
              </td>
            </tr></table>
          </td></tr>

          <!-- hero -->
          <tr><td align="center" style="padding:24px 40px 0;">
            <h1 style="margin:0;font-size:23px;line-height:1.3;font-weight:800;color:#ffffff;">Kode Verifikasi Keamanan</h1>
            <p style="margin:12px auto 0;font-size:14.5px;line-height:1.65;color:rgba(255,255,255,0.55);max-width:400px;">
              Gunakan kode sekali pakai di bawah ini untuk melanjutkan proses
              <strong style="color:rgba(255,255,255,0.82);font-weight:600;">reset kata sandi</strong> akun Anda.
            </p>
          </td></tr>

          <!-- code panel -->
          <tr><td style="padding:28px 40px 6px;">
            <div style="border-radius:18px;background-color:#08180f;background-image:linear-gradient(180deg,#0d2519,#07160e);border:1px solid rgba(16,185,129,0.30);padding:26px 16px;text-align:center;">
              <div style="font-size:10.5px;letter-spacing:3px;text-transform:uppercase;color:#6ee7b7;font-weight:700;margin-bottom:16px;">Kode Verifikasi Anda</div>
              <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;font-size:42px;line-height:1;font-weight:700;letter-spacing:16px;color:#ffffff;text-shadow:0 0 22px rgba(16,185,129,0.45);padding-left:16px;">${otp}</div>

              <!-- tombol salin kode (membuka halaman bantu yang menyalin ke clipboard) -->
              <div style="margin-top:20px;">
                <a href="${BASE_URL}/salin-otp#${otp}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-block;background-color:#10b981;background-image:linear-gradient(90deg,#34d399,#10b981);color:#04100B;text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 26px;border-radius:10px;">
                  &#128203;&nbsp;&nbsp;Salin Kode
                </a>
              </div>
              <div style="margin-top:12px;font-size:11.5px;color:rgba(255,255,255,0.4);">
                &#9201;&nbsp; Berlaku 10 menit &nbsp;&middot;&nbsp; ketuk untuk menyalin
              </div>
            </div>
          </td></tr>

          <!-- security note -->
          <tr><td style="padding:20px 40px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1c160a;border:1px solid rgba(245,158,11,0.24);border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:15px 0 15px 16px;font-size:18px;">🔒</td>
                <td style="padding:15px 16px 15px 8px;font-size:12.5px;line-height:1.65;color:rgba(255,255,255,0.62);">
                  <strong style="color:#fcd34d;font-weight:700;">Jaga kerahasiaan kode ini.</strong><br>
                  ${BRAND} tidak akan pernah meminta kode OTP Anda melalui telepon, chat, maupun email. Jika Anda tidak meminta reset kata sandi, abaikan email ini — akun Anda tetap aman.
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- help -->
          <tr><td align="center" style="padding:22px 40px 0;">
            <p style="margin:0;font-size:12.5px;line-height:1.6;color:rgba(255,255,255,0.42);">
              Butuh bantuan? Hubungi kami di
              <a href="mailto:${SUPPORT_EMAIL}" style="color:#99E39E;text-decoration:none;font-weight:600;">${SUPPORT_EMAIL}</a>
            </p>
          </td></tr>

          <!-- divider -->
          <tr><td style="padding:26px 40px 0;">
            <div style="height:1px;font-size:0;line-height:0;background-color:rgba(255,255,255,0.07);">&nbsp;</div>
          </td></tr>

          <!-- footer -->
          <tr><td align="center" style="padding:22px 40px 36px;">
            <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.55);letter-spacing:0.3px;">${LEGAL}</div>
            <div style="font-size:11px;line-height:1.6;color:rgba(255,255,255,0.32);margin:6px auto 0;max-width:360px;">${ADDRESS}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:14px;">
              &copy; ${year} <a href="${BASE_URL}" style="color:rgba(255,255,255,0.45);text-decoration:none;">${SITE}</a>
              &nbsp;&middot;&nbsp; Terverifikasi &amp; Terlindungi
            </div>
          </td></tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Kirim OTP ke email. Selalu resolve (tidak melempar) agar endpoint tetap
 * mengembalikan respon seragam. `delivered=false` artinya email belum terkirim
 * (biasanya karena env belum diisi).
 */
export async function sendOtpEmail(to: string, otp: string): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    // Mode pengembangan: tampilkan kode di console supaya alur tetap bisa dites.
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. OTP untuk ${to} = ${otp}\n` +
        `   Isi GMAIL_USER & GMAIL_APP_PASSWORD di .env untuk mengirim email sungguhan.\n`
    );
    return { delivered: false };
  }

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject: `${otp} adalah kode verifikasi Anda · ${BRAND}`,
      text:
        `Kode Verifikasi ${BRAND}\n\n` +
        `Kode sekali pakai Anda: ${otp}\n` +
        `Kode ini berlaku selama 10 menit.\n\n` +
        `Gunakan kode ini untuk menyelesaikan reset kata sandi akun Anda.\n` +
        `Jangan bagikan kode ini kepada siapa pun — ${BRAND} tidak akan pernah memintanya.\n` +
        `Jika Anda tidak meminta reset, abaikan email ini.\n\n` +
        `Butuh bantuan? ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: otpEmailHtml(otp),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email OTP:", err);
    return { delivered: false };
  }
}
