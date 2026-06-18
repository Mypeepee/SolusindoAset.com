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
// Bila env belum diisi, sistem TIDAK error — OTP hanya dicatat di console.
//
// TEMA: DARK EMERALD — selaras dengan website (darkmode #000510, primary mint
// #99E39E, emerald #10b981). Di-engineer agar tahan "dark mode" email client:
//  - Latar via atribut `bgcolor` SOLID di tiap sel (bukan hanya background-image
//    gradient, yang tidak bisa diproses Gmail sehingga teks ikut dibalik).
//  - Teks memakai hex SOLID terang (bukan rgba tipis).
//  - <meta color-scheme="dark"> menandai email ini dark-native (jangan dibalik).
//  - Override [data-ogsc]/[data-ogsb] + media query untuk client yang memaksa.
// ---------------------------------------------------------------------------

import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const BRAND = "Solusindo Aset";
const LEGAL = "PT. Solusi Tangguh Rejeki";
const SUPPORT_EMAIL = "closingsystem@gmail.com";
const SUPPORT_WA = "+62 813-3571-6679";
const SUPPORT_WA_LINK = "https://wa.me/6281335716679";
const SITE = "SolusindoAset.com";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://solusindoaset.com";
const ADDRESS =
  "Santorini Town Square, Jl. Ronggolawe No.2A, DR. Soetomo, Kec. Tegalsari, Surabaya, Jawa Timur";

// Palet emerald terpusat (selaras dengan website).
const E = {
  bg: "#000510",        // website darkmode base
  card: "#05160e",      // kartu utama (emerald sangat gelap)
  panel: "#0a2117",     // panel dalam
  cardBorder: "#123d2c",
  panelBorder: "#1c5640",
  divider: "#10342500",
  dividerSolid: "#103425",
  emerald: "#10b981",
  emeraldBright: "#34d399",
  teal: "#1dc8cd",
  mint: "#99e39e",      // primary accent (website)
  ink: "#eaf6ef",       // teks utama (nyaris putih kehijauan)
  inkSoft: "#a7c7b9",   // teks sekunder
  inkMute: "#7c9a8c",   // teks redup
  btnText: "#03130c",   // teks gelap di atas tombol emerald terang
  amber: "#fcd34d",
  amberBg: "#241c06",
  amberBorder: "#4d3d12",
  green: "#34d399",
  greenBg: "#07241a",
  greenBorder: "#1f5e44",
  rose: "#fb7185",
  roseBg: "#2a0f14",
  roseBorder: "#5a2030",
};

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

/* ---------------- Helpers ---------------- */

// Escape karakter HTML supaya data dari pengguna aman ditempel ke markup email.
function esc(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function waDigits(phone?: string | null): string {
  return String(phone || "").replace(/\D/g, "");
}

function formatJoinedAt(d?: Date | null): string {
  const date = d ? new Date(d) : new Date();
  try {
    return (
      new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(date) + " WIB"
    );
  } catch {
    return date.toISOString();
  }
}

/** Satu baris data: label kecil uppercase mint + value terang. */
function dataRow(label: string, value: string, link?: { href: string }): string {
  const inner = link
    ? `<a href="${link.href}" class="em-mint" style="font-size:14px;color:${E.mint};font-weight:600;text-decoration:none;line-height:1.4;word-break:break-word;">${value}</a>`
    : `<div class="em-ink" style="font-size:14px;color:${E.ink};font-weight:600;line-height:1.4;word-break:break-word;">${value}</div>`;
  return `
    <tr>
      <td style="padding:13px 0;border-top:1px solid ${E.dividerSolid};">
        <div class="em-emerald" style="font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:5px;">${label}</div>
        ${inner}
      </td>
    </tr>`;
}

/** Blok kontak (WhatsApp + email) untuk bagian bantuan. */
function helpRow() {
  return `
          <tr><td align="center" style="padding:20px 40px 0;">
            <p class="em-mute" style="margin:0;font-size:12.5px;line-height:1.7;color:${E.inkMute};">
              Butuh bantuan? WhatsApp
              <a href="${SUPPORT_WA_LINK}" style="color:${E.mint};text-decoration:none;font-weight:600;">${esc(SUPPORT_WA)}</a>
              &nbsp;&middot;&nbsp; email
              <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:${E.mint};text-decoration:none;font-weight:600;">${esc(SUPPORT_EMAIL)}</a>
            </p>
          </td></tr>`;
}

/**
 * Shell email bersama (DARK EMERALD). bgcolor solid di tiap sel + override
 * dark-mode untuk menjaga keterbacaan.
 */
function renderEmailShell(opts: { title: string; preheader: string; content: string }) {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="id" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${esc(opts.title)}</title>
  <!--[if mso]><style>*{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
  <style>
    /* Email ini dark-native. Paksa tetap gelap + teks terang walau client
       mencoba menerapkan "dark mode"-nya sendiri (Apple Mail / Outlook.com). */
    @media (prefers-color-scheme: dark) {
      .em-body{background-color:${E.bg} !important;}
      .em-card{background-color:${E.card} !important;}
      .em-panel{background-color:${E.panel} !important;}
      .em-ink{color:${E.ink} !important;}
      .em-soft{color:${E.inkSoft} !important;}
      .em-mute{color:${E.inkMute} !important;}
      .em-mint{color:${E.mint} !important;}
      .em-emerald{color:${E.emeraldBright} !important;}
    }
    [data-ogsc] .em-ink{color:${E.ink} !important;}
    [data-ogsc] .em-soft{color:${E.inkSoft} !important;}
    [data-ogsc] .em-mute{color:${E.inkMute} !important;}
    [data-ogsc] .em-mint{color:${E.mint} !important;}
    [data-ogsc] .em-emerald{color:${E.emeraldBright} !important;}
    [data-ogsb] .em-body{background-color:${E.bg} !important;}
    [data-ogsb] .em-card{background-color:${E.card} !important;}
    [data-ogsb] .em-panel{background-color:${E.panel} !important;}
  </style>
</head>
<body class="em-body" bgcolor="${E.bg}" style="margin:0;padding:0;background-color:${E.bg};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;mso-hide:all;">${esc(opts.preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.bg}" class="em-body" style="background-color:${E.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:34px 16px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.card}" class="em-card" style="max-width:600px;width:100%;background-color:${E.card};border:1px solid ${E.cardBorder};border-radius:22px;overflow:hidden;">

          <!-- accent bar -->
          <tr><td bgcolor="${E.emerald}" height="6" style="height:6px;line-height:6px;font-size:0;background-color:${E.emerald};background-image:linear-gradient(90deg,${E.emeraldBright},${E.emerald},${E.teal},${E.emeraldBright});">&nbsp;</td></tr>

          <!-- brand header -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:30px 40px 6px;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td valign="middle" width="50" style="width:50px;">
                <div style="width:48px;height:48px;line-height:48px;text-align:center;border-radius:14px;background-color:${E.emerald};background-image:linear-gradient(145deg,${E.emeraldBright},${E.emerald});color:${E.btnText};font-size:17px;font-weight:800;letter-spacing:0.5px;">SA</div>
              </td>
              <td width="13" style="width:13px;">&nbsp;</td>
              <td valign="middle" align="left">
                <div class="em-ink" style="font-size:18px;font-weight:800;color:${E.ink};line-height:1.1;">Solusindo <span class="em-mint" style="color:${E.mint};">Aset</span></div>
                <div class="em-mute" style="font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${E.inkMute};margin-top:4px;">Property &amp; Asset Platform</div>
              </td>
            </tr></table>
          </td></tr>

          ${opts.content}

          <!-- divider -->
          <tr><td bgcolor="${E.card}" style="padding:24px 40px 0;background-color:${E.card};">
            <div style="height:1px;font-size:0;line-height:0;background-color:${E.dividerSolid};">&nbsp;</div>
          </td></tr>

          <!-- footer -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 34px;background-color:${E.card};">
            <div class="em-soft" style="font-size:12px;font-weight:700;color:${E.inkSoft};letter-spacing:0.3px;">${esc(LEGAL)}</div>
            <div class="em-mute" style="font-size:11px;line-height:1.6;color:${E.inkMute};margin:6px auto 0;max-width:360px;">${esc(ADDRESS)}</div>
            <div class="em-mute" style="font-size:11px;color:${E.inkMute};margin-top:12px;">
              &copy; ${year} <a href="${esc(BASE_URL)}" style="color:${E.mint};text-decoration:none;font-weight:600;">${esc(SITE)}</a>
              &nbsp;&middot;&nbsp; Notifikasi otomatis
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

/** Tombol CTA emerald (teks gelap; tahan Outlook via VML). */
function ctaButton(href: string, label: string) {
  return `
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:50px;v-text-anchor:middle;width:320px;" arcsize="22%" fillcolor="${E.emerald}" stroke="f">
            <w:anchorlock/><center style="color:${E.btnText};font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">${label}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-- -->
            <a href="${href}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;background-color:${E.emerald};background-image:linear-gradient(90deg,${E.emeraldBright},${E.emerald});color:${E.btnText};text-decoration:none;font-size:14.5px;font-weight:800;padding:15px 38px;border-radius:12px;letter-spacing:0.2px;">
              ${label} &nbsp;&rarr;
            </a>
            <!--<![endif]-->`;
}

/* ===========================================================================
 *  EMAIL 1: AGENT BARU BERGABUNG  →  OWNER / PRINCIPAL / UPLINE
 * ========================================================================= */

export type NewAgentEmailOpts = {
  recipientName?: string | null;
  recipientRole: "OWNER" | "PRINCIPAL" | "UPLINE";
  agentName: string;
  agentId: string;
  office: string;
  area: string;
  whatsapp?: string | null;
  agentEmail?: string | null;
  joinedAt?: Date | null;
  reviewUrl: string;
  uplineCode?: string | null;
};

export function newAgentEmailHtml(o: NewAgentEmailOpts) {
  const name = esc(o.agentName || "Agent Baru");
  const office = esc(o.office || "-");
  const area = esc(o.area || "-");
  const agentId = esc(o.agentId || "-");
  const initials = esc(initialsOf(o.agentName));
  const joined = esc(formatJoinedAt(o.joinedAt));
  const wa = waDigits(o.whatsapp);
  const waDisplay = esc(o.whatsapp || "-");
  const emailDisplay = esc(o.agentEmail || "-");
  const review = esc(o.reviewUrl);
  const greet = o.recipientName ? `Halo, ${esc(o.recipientName)}` : "Halo";
  const uplineCode = esc(o.uplineCode || "-");
  const isUpline = o.recipientRole === "UPLINE";

  const strong = (t: string) =>
    `<strong class="em-mint" style="color:${E.mint};font-weight:700;">${t}</strong>`;

  const pillText = isUpline ? "Referral Berhasil" : "Agent Baru Bergabung";

  const headline = isUpline
    ? `${greet}! Jaringan Anda<br>bertambah 🎉`
    : `${greet}! Ada talenta baru<br>di tim Anda 🎉`;

  const lead = isUpline
    ? `${strong(name)} baru saja mendaftar sebagai agent menggunakan kode referral ${strong(uplineCode)} milik Anda.`
    : o.recipientRole === "OWNER"
      ? `Seorang agent baru telah mendaftar di jaringan ${strong(esc(SITE))} dan menunggu verifikasi.`
      : `Seorang agent baru telah mendaftar di kantor ${strong(office)} yang Anda pimpin, dan menunggu verifikasi.`;

  const ctaLabel = isUpline ? "Lihat Detail Agent" : "Tinjau &amp; Verifikasi Agent";
  const ctaSub = isUpline
    ? `Agent ini terhubung ke jaringan Anda melalui<br>kode referral. Verifikasi diproses oleh pimpinan kantor.`
    : `Buka panel <strong style="color:${E.inkSoft};font-weight:700;">Human Resource Management</strong><br>untuk memverifikasi &amp; mengaktifkan agent ini.`;

  const noteTitle = isUpline ? "Sedang menunggu verifikasi." : "Status masih PENDING.";
  const noteBody = isUpline
    ? `Pendaftaran ini sedang ditinjau oleh principal/owner kantor. Agent akan otomatis aktif di jaringan Anda begitu disetujui — tidak ada tindakan yang perlu Anda lakukan.`
    : `Agent belum dapat mengakses fitur penuh sampai Anda menyetujui pendaftaran. Pastikan dokumen (KTP, NPWP, foto profil) sudah valid sebelum mengaktifkan.`;

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;">
              <tr><td class="em-mint" style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.mint};font-weight:800;">
                <span style="color:${E.emeraldBright};">&#9679;</span>&nbsp;&nbsp;${pillText}
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${headline}</h1>
            <p class="em-soft" style="margin:13px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:430px;">${lead}</p>
          </td></tr>

          <!-- profile card -->
          <tr><td bgcolor="${E.card}" style="padding:24px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td style="padding:22px 22px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" width="64" style="width:64px;">
                    <div style="width:60px;height:60px;line-height:60px;text-align:center;border-radius:16px;background-color:${E.emerald};background-image:linear-gradient(145deg,${E.emeraldBright},${E.emerald});color:${E.btnText};font-size:22px;font-weight:800;">${initials}</div>
                  </td>
                  <td width="15" style="width:15px;">&nbsp;</td>
                  <td valign="middle" align="left">
                    <div class="em-ink" style="font-size:17px;font-weight:800;color:${E.ink};line-height:1.25;">${name}</div>
                    <div style="margin-top:7px;">
                      <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;color:${E.mint};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:7px;padding:3px 9px;letter-spacing:0.5px;">${agentId}</span>
                      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${E.amber};background-color:${E.amberBg};border:1px solid ${E.amberBorder};border-radius:7px;padding:4px 9px;margin-left:4px;">&#9203; Pending</span>
                    </div>
                  </td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:0 22px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${dataRow("Kantor", office)}
                  ${dataRow("Kota / Area", area)}
                  ${wa ? dataRow("WhatsApp", waDisplay, { href: `https://wa.me/${wa}` }) : dataRow("WhatsApp", waDisplay)}
                  ${o.agentEmail ? dataRow("Email", emailDisplay, { href: `mailto:${esc(o.agentEmail)}` }) : ""}
                  ${dataRow("Waktu Pendaftaran", joined)}
                </table>
              </td></tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:24px 40px 4px;background-color:${E.card};">
            ${ctaButton(review, ctaLabel)}
            <div class="em-mute" style="margin-top:13px;font-size:11.5px;color:${E.inkMute};line-height:1.6;">${ctaSub}</div>
          </td></tr>

          <!-- info note -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.amberBg}" style="background-color:${E.amberBg};border:1px solid ${E.amberBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">&#128274;</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong style="color:${E.amber};font-weight:700;">${noteTitle}</strong><br>${noteBody}
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Agent Baru Bergabung`,
    preheader: `${o.agentName} baru saja mendaftar sebagai agent · status PENDING · menunggu verifikasi Anda.`,
    content,
  });
}

export async function sendNewAgentEmail(
  to: string,
  opts: NewAgentEmailOpts
): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email "agent baru" untuk ${to} tidak dikirim.\n` +
        `   Agent: ${opts.agentName} (${opts.agentId}) — kantor ${opts.office}.\n`
    );
    return { delivered: false };
  }

  const isUpline = opts.recipientRole === "UPLINE";
  const subject = isUpline
    ? `🎉 ${opts.agentName} bergabung pakai kode referral Anda · ${BRAND}`
    : `🎉 Agent baru: ${opts.agentName} menunggu verifikasi · ${BRAND}`;

  const intro = isUpline
    ? `${opts.agentName} (${opts.agentId}) baru saja mendaftar sebagai agent menggunakan kode referral ${opts.uplineCode || "-"} milik Anda.`
    : `${opts.agentName} (${opts.agentId}) baru saja mendaftar sebagai agent dan menunggu verifikasi.`;

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject,
      text:
        `${isUpline ? "Referral Berhasil" : "Agent Baru Bergabung"} — ${BRAND}\n\n` +
        `${intro}\n\n` +
        `Kantor          : ${opts.office}\n` +
        `Kota / Area     : ${opts.area}\n` +
        `WhatsApp        : ${opts.whatsapp || "-"}\n` +
        `Email           : ${opts.agentEmail || "-"}\n` +
        `Waktu daftar    : ${formatJoinedAt(opts.joinedAt)}\n` +
        `Status          : PENDING (menunggu verifikasi)\n\n` +
        `${isUpline ? "Lihat detail" : "Tinjau & verifikasi"} di: ${opts.reviewUrl}\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: newAgentEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email 'agent baru':", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 2: KEPUTUSAN PENDAFTARAN  →  AGENT (diterima / ditolak)
 * ========================================================================= */

export type AgentDecisionEmailOpts = {
  agentName: string;
  agentId: string;
  office?: string | null;
  decision: "ACCEPTED" | "REJECTED";
  wasPending?: boolean;
  actionUrl: string;
  note?: string | null;
};

export function agentDecisionEmailHtml(o: AgentDecisionEmailOpts) {
  const name = esc(o.agentName || "Agent");
  const agentId = esc(o.agentId || "-");
  const office = esc(o.office || "-");
  const initials = esc(initialsOf(o.agentName));
  const action = esc(o.actionUrl);
  const accepted = o.decision === "ACCEPTED";
  const noteText = o.note ? esc(o.note) : "";

  const accent = accepted ? E.green : E.rose;
  const pillBg = accepted ? E.greenBg : E.roseBg;
  const pillBorder = accepted ? E.greenBorder : E.roseBorder;

  const pillText = accepted
    ? o.wasPending
      ? "Pendaftaran Diterima"
      : "Akun Diaktifkan"
    : o.wasPending
      ? "Hasil Peninjauan"
      : "Akun Dinonaktifkan";

  const headline = accepted ? `Selamat, ${name}! 🎉` : `Halo, ${name}`;

  const lead = accepted
    ? o.wasPending
      ? `Kabar baik! Pendaftaran Anda sebagai agent <strong style="color:${accent};font-weight:700;">${esc(SITE)}</strong> telah <strong style="color:${accent};font-weight:700;">disetujui</strong>. Akun Anda kini berstatus AKTIF dan siap digunakan.`
      : `Akun agent Anda telah <strong style="color:${accent};font-weight:700;">diaktifkan kembali</strong>. Selamat datang kembali!`
    : o.wasPending
      ? `Terima kasih atas minat Anda bergabung bersama kami. Mohon maaf, untuk saat ini pendaftaran Anda <strong style="color:${accent};font-weight:700;">belum dapat kami setujui</strong>.`
      : `Kami informasikan bahwa akun agent Anda untuk sementara <strong style="color:${accent};font-weight:700;">dinonaktifkan</strong>.`;

  const statusBadge = accepted ? "AKTIF" : o.wasPending ? "Belum Disetujui" : "Nonaktif";
  const badgeIcon = accepted ? "&#10003;" : "&#10005;";

  const ctaLabel = accepted
    ? "Masuk ke Dashboard"
    : o.wasPending
      ? "Ajukan Pendaftaran Ulang"
      : "Hubungi Tim Kami";

  const noteTitle = accepted ? "Langkah berikutnya" : "Ada pertanyaan?";
  const noteBody = accepted
    ? `Masuk ke dashboard untuk melengkapi profil, menambah listing, dan mulai closing. Selamat berkarya bersama ${BRAND}! 🚀`
    : `Anda dapat menghubungi pimpinan kantor atau tim kami untuk informasi lebih lanjut${o.wasPending ? ", dan mengajukan pendaftaran kembali setelah melengkapi persyaratan" : ""}.`;

  const reasonBlock = noteText
    ? `
          <tr><td bgcolor="${E.card}" style="padding:18px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:14px;">
              <tr><td style="padding:14px 18px;">
                <div class="em-emerald" style="font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:6px;">Catatan dari Peninjau</div>
                <div class="em-ink" style="font-size:13px;line-height:1.6;color:${E.ink};">${noteText}</div>
              </td></tr>
            </table>
          </td></tr>`
    : "";

  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${pillBg}" style="background-color:${pillBg};border:1px solid ${pillBorder};border-radius:999px;">
              <tr><td style="padding:7px 16px 7px 14px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${accent};font-weight:800;">
                <span style="color:${accent};">&#9679;</span>&nbsp;&nbsp;${pillText}
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:24px;line-height:1.3;font-weight:800;color:${E.ink};letter-spacing:-0.2px;">${headline}</h1>
            <p class="em-soft" style="margin:13px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:430px;">${lead}</p>
          </td></tr>

          <!-- agent card -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td style="padding:20px 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td valign="middle" width="58" style="width:58px;">
                    <div style="width:54px;height:54px;line-height:54px;text-align:center;border-radius:15px;background-color:${E.emerald};background-image:linear-gradient(145deg,${E.emeraldBright},${E.emerald});color:${E.btnText};font-size:20px;font-weight:800;">${initials}</div>
                  </td>
                  <td width="14" style="width:14px;">&nbsp;</td>
                  <td valign="middle" align="left">
                    <div class="em-ink" style="font-size:16px;font-weight:800;color:${E.ink};line-height:1.25;">${name}</div>
                    <div style="margin-top:6px;">
                      <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,Menlo,monospace;font-size:11px;color:${E.mint};background-color:#082018;border:1px solid ${E.panelBorder};border-radius:7px;padding:3px 9px;">${agentId}</span>
                      <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${accent};background-color:${pillBg};border:1px solid ${pillBorder};border-radius:7px;padding:4px 9px;margin-left:4px;">${badgeIcon}&nbsp; ${statusBadge}</span>
                    </div>
                    <div class="em-mute" style="margin-top:8px;font-size:11.5px;color:${E.inkMute};">Kantor: <span class="em-soft" style="color:${E.inkSoft};font-weight:600;">${office}</span></div>
                  </td>
                </tr></table>
              </td></tr>
            </table>
          </td></tr>
          ${reasonBlock}

          <!-- CTA -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:24px 40px 4px;background-color:${E.card};">
            ${ctaButton(action, ctaLabel)}
          </td></tr>

          <!-- info note -->
          <tr><td bgcolor="${E.card}" style="padding:22px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">${accepted ? "&#128640;" : "&#128172;"}</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong class="em-mint" style="color:${E.mint};font-weight:700;">${noteTitle}.</strong><br>${noteBody}
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Status Pendaftaran Agent`,
    preheader: accepted
      ? `Selamat! Pendaftaran agent Anda telah disetujui dan akun Anda kini AKTIF.`
      : `Informasi mengenai status pendaftaran/akun agent Anda di ${SITE}.`,
    content,
  });
}

export async function sendAgentDecisionEmail(
  to: string,
  opts: AgentDecisionEmailOpts
): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
    console.warn(
      `\n📧 [DEV] SMTP belum dikonfigurasi. Email keputusan (${opts.decision}) untuk ${to} tidak dikirim.\n` +
        `   Agent: ${opts.agentName} (${opts.agentId}).\n`
    );
    return { delivered: false };
  }

  const accepted = opts.decision === "ACCEPTED";
  const subject = accepted
    ? opts.wasPending
      ? `🎉 Selamat! Pendaftaran agent Anda diterima · ${BRAND}`
      : `✅ Akun agent Anda telah diaktifkan · ${BRAND}`
    : `Informasi status pendaftaran agent Anda · ${BRAND}`;

  const bodyLine = accepted
    ? opts.wasPending
      ? `Selamat! Pendaftaran Anda sebagai agent ${SITE} telah DISETUJUI. Akun Anda kini AKTIF dan siap digunakan.`
      : `Akun agent Anda telah diaktifkan kembali. Selamat datang kembali!`
    : opts.wasPending
      ? `Mohon maaf, untuk saat ini pendaftaran Anda sebagai agent belum dapat kami setujui.`
      : `Akun agent Anda untuk sementara dinonaktifkan.`;

  try {
    await getTransport().sendMail({
      from: `"${BRAND}" <${GMAIL_USER}>`,
      to,
      subject,
      text:
        `Status Pendaftaran Agent — ${BRAND}\n\n` +
        `Halo ${opts.agentName} (${opts.agentId}),\n\n` +
        `${bodyLine}\n` +
        (opts.note ? `\nCatatan dari peninjau: ${opts.note}\n` : "") +
        `\n${accepted ? "Masuk ke dashboard" : "Selengkapnya"}: ${opts.actionUrl}\n\n` +
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: agentDecisionEmailHtml(opts),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email keputusan agent:", err);
    return { delivered: false };
  }
}

/* ===========================================================================
 *  EMAIL 3: OTP / KODE VERIFIKASI  →  reset kata sandi
 * ========================================================================= */

function otpEmailHtml(otp: string) {
  const code = esc(otp);
  const content = `
          <!-- pill -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:999px;">
              <tr><td class="em-mint" style="padding:7px 16px;font-size:10.5px;letter-spacing:2.5px;text-transform:uppercase;color:${E.mint};font-weight:800;">
                &#128274;&nbsp;&nbsp;Kode Keamanan
              </td></tr>
            </table>
          </td></tr>

          <!-- hero -->
          <tr><td bgcolor="${E.card}" align="center" style="padding:16px 40px 0;background-color:${E.card};">
            <h1 class="em-ink" style="margin:0;font-size:23px;line-height:1.3;font-weight:800;color:${E.ink};">Kode Verifikasi Anda</h1>
            <p class="em-soft" style="margin:12px auto 0;font-size:14.5px;line-height:1.65;color:${E.inkSoft};max-width:400px;">
              Gunakan kode sekali pakai di bawah untuk melanjutkan proses
              <strong class="em-mint" style="color:${E.mint};font-weight:700;">reset kata sandi</strong> akun Anda.
            </p>
          </td></tr>

          <!-- code panel -->
          <tr><td bgcolor="${E.card}" style="padding:24px 40px 4px;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.panel}" class="em-panel" style="background-color:${E.panel};border:1px solid ${E.panelBorder};border-radius:18px;">
              <tr><td align="center" style="padding:26px 16px;">
                <div class="em-emerald" style="font-size:10.5px;letter-spacing:3px;text-transform:uppercase;color:${E.emeraldBright};font-weight:700;margin-bottom:16px;">Kode Verifikasi Anda</div>
                <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace;font-size:42px;line-height:1;font-weight:800;letter-spacing:14px;color:${E.ink};padding-left:14px;">${code}</div>
                <div style="margin-top:20px;">
                  <a href="${BASE_URL}/salin-otp#${code}" target="_blank" rel="noopener noreferrer"
                     style="display:inline-block;background-color:${E.emerald};background-image:linear-gradient(90deg,${E.emeraldBright},${E.emerald});color:${E.btnText};text-decoration:none;font-size:13.5px;font-weight:700;padding:12px 26px;border-radius:10px;">
                    &#128203;&nbsp;&nbsp;Salin Kode
                  </a>
                </div>
                <div class="em-mute" style="margin-top:12px;font-size:11.5px;color:${E.inkMute};">
                  &#9201;&nbsp; Berlaku 10 menit &nbsp;&middot;&nbsp; ketuk untuk menyalin
                </div>
              </td></tr>
            </table>
          </td></tr>

          <!-- security note -->
          <tr><td bgcolor="${E.card}" style="padding:20px 40px 0;background-color:${E.card};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${E.amberBg}" style="background-color:${E.amberBg};border:1px solid ${E.amberBorder};border-radius:14px;">
              <tr>
                <td valign="top" width="40" style="padding:14px 0 14px 16px;font-size:17px;">&#128272;</td>
                <td class="em-soft" style="padding:14px 16px 14px 8px;font-size:12.5px;line-height:1.65;color:${E.inkSoft};">
                  <strong style="color:${E.amber};font-weight:700;">Jaga kerahasiaan kode ini.</strong><br>
                  ${BRAND} tidak akan pernah meminta kode OTP Anda melalui telepon, chat, maupun email. Jika Anda tidak meminta reset kata sandi, abaikan email ini — akun Anda tetap aman.
                </td>
              </tr>
            </table>
          </td></tr>
          ${helpRow()}`;

  return renderEmailShell({
    title: `${BRAND} — Kode Verifikasi`,
    preheader: `Kode verifikasi sekali pakai Anda berlaku 10 menit. Jangan bagikan kepada siapa pun.`,
    content,
  });
}

export async function sendOtpEmail(to: string, otp: string): Promise<{ delivered: boolean }> {
  if (!isMailConfigured()) {
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
        `Butuh bantuan? WhatsApp ${SUPPORT_WA} · email ${SUPPORT_EMAIL}\n` +
        `© ${new Date().getFullYear()} ${LEGAL} · ${SITE}`,
      html: otpEmailHtml(otp),
    });
    return { delivered: true };
  } catch (err) {
    console.error("❌ Gagal mengirim email OTP:", err);
    return { delivered: false };
  }
}
