import { NextResponse } from "next/server";
import { createSign } from "crypto";
import { readFileSync } from "fs";

export const runtime = "nodejs";
export const maxDuration = 30;

// ════════════════════════════════════════════════════════════════════════════
// Service Account JWT auth (no gRPC, pure REST)
// ════════════════════════════════════════════════════════════════════════════

type ServiceAccount = { client_email: string; private_key: string };

let tokenCache: { value: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) throw new Error("GOOGLE_APPLICATION_CREDENTIALS belum diset di .env");
  return JSON.parse(readFileSync(path, "utf-8")) as ServiceAccount;
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 120_000) return tokenCache.value;

  const sa  = loadServiceAccount();
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-vision",
    aud: "https://oauth2.googleapis.com/token",
    exp, iat,
  })).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, "base64url");
  const jwt = `${header}.${payload}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error_description?: string })?.error_description ?? "Gagal mendapatkan access token");
  }

  const data = (await res.json()) as { access_token: string };
  tokenCache = { value: data.access_token, expiresAt: now + 3500_000 };
  return data.access_token;
}

// ════════════════════════════════════════════════════════════════════════════
// Vision API: word-level extraction with bounding boxes
// ════════════════════════════════════════════════════════════════════════════

type Vertex = { x?: number; y?: number };
type Symbol_ = { text?: string; property?: { detectedBreak?: { type?: string } } };
type WordRaw = { symbols?: Symbol_[]; boundingBox?: { vertices?: Vertex[] } };
type ParaRaw = { words?: WordRaw[]; boundingBox?: { vertices?: Vertex[] } };
type BlockRaw = { paragraphs?: ParaRaw[] };
type Page = { width?: number; height?: number; blocks?: BlockRaw[] };

type Token = {
  text: string;
  x: number;   // top-left x
  y: number;   // top-left y
  cx: number;  // center x
  cy: number;  // center y
  w: number;   // width
  h: number;   // height
};

/** Extract every word from Vision response with its bounding box */
function extractTokens(page: Page): Token[] {
  const tokens: Token[] = [];

  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const word of para.words ?? []) {
        const text = (word.symbols ?? []).map((s) => s.text ?? "").join("").trim();
        if (!text) continue;

        const verts = word.boundingBox?.vertices ?? [];
        if (verts.length < 2) continue;

        const xs = verts.map((v) => v.x ?? 0);
        const ys = verts.map((v) => v.y ?? 0);
        const x  = Math.min(...xs);
        const y  = Math.min(...ys);
        const w  = Math.max(...xs) - x;
        const h  = Math.max(...ys) - y;

        tokens.push({ text, x, y, cx: x + w / 2, cy: y + h / 2, w, h });
      }
    }
  }
  return tokens;
}

/** Cluster tokens into rows using adaptive y-threshold based on word heights */
function clusterRows(tokens: Token[]): Token[][] {
  if (!tokens.length) return [];

  // Median height = baseline for row threshold
  const heights = tokens.map((t) => t.h).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 15;
  const threshold = medianH * 0.55; // tolerance for row alignment

  const sorted = [...tokens].sort((a, b) => a.cy - b.cy);
  const rows: Token[][] = [];

  for (const tok of sorted) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow) { rows.push([tok]); continue; }

    // Use average cy of last row to handle slight tilt
    const avgCy = lastRow.reduce((s, t) => s + t.cy, 0) / lastRow.length;
    if (Math.abs(tok.cy - avgCy) <= threshold) {
      lastRow.push(tok);
    } else {
      rows.push([tok]);
    }
  }

  return rows;
}

/**
 * Find x-position of label/value separator (the colon column).
 * Returns the median x of all ":" tokens. If too few colons, returns null.
 */
function findColonBoundary(tokens: Token[]): number | null {
  const colons = tokens.filter((t) => t.text === ":" || t.text === ";");
  if (colons.length < 3) return null; // need at least 3 colons to be confident
  const xs = colons.map((c) => c.x).sort((a, b) => a - b);
  return xs[Math.floor(xs.length / 2)];
}

/**
 * Reconstruct text as clean "LABEL : VALUE" lines using:
 * 1. Word-level extraction (per kata, bukan per paragraf)
 * 2. Adaptive row clustering (toleransi miring & resolusi)
 * 3. Column-aware split using colon boundary x-position
 */
function reconstructText(page: Page): string {
  const tokens = extractTokens(page);
  if (!tokens.length) return "";

  const rows = clusterRows(tokens);
  const colonX = findColonBoundary(tokens);

  const lines: string[] = [];

  for (const row of rows) {
    const sorted = [...row].sort((a, b) => a.x - b.x);

    // Strategi 1: cari posisi colon dalam baris
    const colonTokIdx = sorted.findIndex(
      (t) => t.text === ":" || t.text === ";" || t.text.endsWith(":") || t.text.startsWith(":"),
    );

    if (colonTokIdx !== -1) {
      const colonTok = sorted[colonTokIdx];
      let label: string, value: string;

      if (colonTok.text === ":" || colonTok.text === ";") {
        label = sorted.slice(0, colonTokIdx).map((t) => t.text).join(" ");
        value = sorted.slice(colonTokIdx + 1).map((t) => t.text).join(" ");
      } else if (colonTok.text.endsWith(":")) {
        // "Status:" → "Status" + rest
        const labelPart = colonTok.text.slice(0, -1);
        const beforeLabel = sorted.slice(0, colonTokIdx).map((t) => t.text).join(" ");
        label = (beforeLabel + " " + labelPart).trim();
        value = sorted.slice(colonTokIdx + 1).map((t) => t.text).join(" ");
      } else {
        // ":VALUE" → previous tokens are label, this token (minus colon) starts value
        const valuePart = colonTok.text.slice(1);
        label = sorted.slice(0, colonTokIdx).map((t) => t.text).join(" ");
        const restValue = sorted.slice(colonTokIdx + 1).map((t) => t.text).join(" ");
        value = (valuePart + " " + restValue).trim();
      }

      lines.push(`${label.trim()} : ${value.trim()}`);
      continue;
    }

    // Strategi 2: tidak ada colon — pakai posisi colon kolom (jika ada)
    if (colonX !== null) {
      const labelToks = sorted.filter((t) => t.cx < colonX);
      const valueToks = sorted.filter((t) => t.cx >= colonX);
      const label = labelToks.map((t) => t.text).join(" ").trim();
      const value = valueToks.map((t) => t.text).join(" ").trim();
      if (label && value) {
        lines.push(`${label} : ${value}`);
        continue;
      }
    }

    // Strategi 3: baris tanpa colon dan tidak bisa di-split → output as-is
    lines.push(sorted.map((t) => t.text).join(" "));
  }

  return lines.join("\n");
}

// ════════════════════════════════════════════════════════════════════════════
// Google Vision REST API call
// ════════════════════════════════════════════════════════════════════════════

async function extractText(buffer: Buffer): Promise<string> {
  const token  = await getAccessToken();
  const base64 = buffer.toString("base64");

  const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
        imageContext: { languageHints: ["id", "en"] },
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = (body as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw Object.assign(new Error(msg), { status: res.status });
  }

  const data = (await res.json()) as {
    responses?: Array<{ fullTextAnnotation?: { text?: string; pages?: Page[] } }>;
  };

  const ann   = data?.responses?.[0]?.fullTextAnnotation;
  const pages = ann?.pages ?? [];

  const reconstructed = pages.length ? reconstructText(pages[0]) : "";
  const text          = reconstructed.trim() ? reconstructed : (ann?.text ?? "");

  console.log("=== VISION RECONSTRUCTED ===\n" + text + "\n============================");
  return text;
}

// ════════════════════════════════════════════════════════════════════════════
// KTP Field Parser
// ════════════════════════════════════════════════════════════════════════════

// Daftar label KTP yang dikenal — urutan penting (panjang dulu)
const KTP_LABEL_DEFS: Array<{ re: RegExp; key: string }> = [
  { re: /^TEMPAT\s*[/\s]\s*(TGL|IGL|TGI)\s*LAHIR\b/i, key: "TEMPAT/TGL LAHIR" },
  { re: /^STATUS\s*PERKAWINAN\b/i,                      key: "STATUS PERKAWINAN" },
  { re: /^BERLAKU\s*HINGGA\b/i,                         key: "BERLAKU HINGGA" },
  { re: /^JENIS\s*KELAMIN\b/i,                          key: "JENIS KELAMIN" },
  { re: /^KEWARGANEGARAAN\b/i,                          key: "KEWARGANEGARAAN" },
  { re: /^KECAMATAN\b/i,                                key: "KECAMATAN" },
  { re: /^KEL\s*[/\s]\s*DESA\b/i,                      key: "KEL/DESA" },
  { re: /^GOL\s*\.?\s*DARAH\b/i,                        key: "GOL DARAH" },
  { re: /^PEKERJAAN\b/i,                                key: "PEKERJAAN" },
  { re: /^ALAMAT\b/i,                                   key: "ALAMAT" },
  { re: /^AGAMA\b/i,                                    key: "AGAMA" },
  { re: /^NAMA\b/i,                                     key: "NAMA" },
  { re: /^NIK\b/i,                                      key: "NIK" },
  { re: /^RT\s*[/\s]\s*RW\b/i,                         key: "RT/RW" },
];

function normalizeLabel(raw: string): string {
  const up = raw.trim().toUpperCase();
  for (const { re, key } of KTP_LABEL_DEFS) {
    if (re.test(up)) return key;
  }
  return up.replace(/\s+/g, " ");
}

/**
 * Build field map dari teks KTP.
 * Menangani dua format:
 * 1. "LABEL : VALUE"  → split di titik dua
 * 2. "LABEL VALUE"    → cocokkan dengan pola label KTP yang dikenal
 */
function buildFieldMap(text: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip header
    if (/^(PROVINSI|KOTA|KABUPATEN)\s/i.test(line)) continue;

    // ── Strategi 1: ada titik dua di posisi wajar ────────────────────
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      const rawLabel = line.slice(0, colonIdx).trim();
      const value    = line.slice(colonIdx + 1).replace(/^[:\s]+/, "").trim();
      if (!rawLabel || !value) {
        // Tetap coba strategi 2 jika nilai kosong
      } else {
        const label = normalizeLabel(rawLabel);
        if (!fields[label]) fields[label] = value;
        continue;
      }
    }

    // ── Strategi 2: tidak ada titik dua — cocokkan label KTP ────────
    for (const { re, key } of KTP_LABEL_DEFS) {
      const m = line.match(re);
      if (!m) continue;
      const value = line.slice(m[0].length).replace(/^[\s:]+/, "").trim();
      if (value && !fields[key]) fields[key] = value;
      break;
    }
  }

  return fields;
}

/** Find field by exact key or partial match */
function findField(fields: Record<string, string>, ...needles: string[]): string {
  for (const needle of needles) {
    // Exact key match dulu
    if (fields[needle]) return fields[needle];
    // Partial match
    for (const key of Object.keys(fields)) {
      if (key.includes(needle.toUpperCase()) || needle.toUpperCase().includes(key)) {
        return fields[key];
      }
    }
  }
  return "";
}

/** Normalize address: remove OCR-added spaces around "/" */
function normalizeAddr(s: string): string {
  return s.replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
}

/** Validate NIK format: 16 digits */
function isValidNIK(nik: string): boolean {
  return /^\d{16}$/.test(nik);
}

/**
 * Normalize OCR-misread characters in a NIK string.
 * NIK is always 16 digits — map common letter↔digit confusions then strip non-digits.
 * Mapping based on visual similarity under KTP background pattern noise.
 */
function normalizeNikOcr(raw: string): string {
  // Per-character replacement before stripping non-digits
  const charMap: Record<string, string> = {
    // 0-like
    O: "0", o: "0", Q: "0", D: "0", U: "0", u: "0",
    // 1-like
    I: "1", i: "1", l: "1", L: "1", "|": "1",
    // 2-like
    Z: "2", z: "2",
    // 3-like
    E: "3", e: "3",
    // 4-like
    A: "4",
    // 5-like
    S: "5", s: "5",
    // 6-like
    G: "6", b: "6",
    // 7-like
    T: "7",
    // 8-like
    B: "8",
    // 9-like
    g: "9", q: "9",
  };
  return raw
    .split("")
    .map((c) => charMap[c] ?? c)
    .join("")
    .replace(/\D/g, "");
}

/**
 * Decode birth date from NIK (validation cross-check)
 * NIK format: PPRRSS DDMMYY NNNN
 * - For females: DD = actual day + 40
 */
function birthDateFromNIK(nik: string): string | null {
  if (!isValidNIK(nik)) return null;
  const ddRaw = parseInt(nik.slice(6, 8), 10);
  const mm    = nik.slice(8, 10);
  const yy    = parseInt(nik.slice(10, 12), 10);

  const dd     = ddRaw > 40 ? ddRaw - 40 : ddRaw;
  if (dd < 1 || dd > 31) return null;
  if (parseInt(mm, 10) < 1 || parseInt(mm, 10) > 12) return null;

  // YY < 30 → 20YY, else 19YY (heuristic — should cover 1930-2029)
  const fullYear = yy < 30 ? 2000 + yy : 1900 + yy;
  return `${String(dd).padStart(2, "0")}-${mm}-${fullYear}`;
}

/** Parse "TEMPAT, DD-MM-YYYY" — find date first, take last word group before comma */
function parseTTL(raw: string): { tempat: string; tgl: string } {
  const dm = raw.match(/(\d{1,2})[\s-/](\d{1,2})[\s-/](\d{4})/);
  if (!dm) return { tempat: raw.trim(), tgl: "" };

  const tgl = `${dm[1].padStart(2, "0")}-${dm[2].padStart(2, "0")}-${dm[3]}`;
  const beforeDate = raw.slice(0, dm.index).replace(/[,\s]+$/, "").trim();
  // Last group of capitalized words = city name
  const parts = beforeDate.split(/\s{2,}|,/).map((s) => s.trim()).filter(Boolean);
  const tempat = parts.at(-1) ?? beforeDate;
  return { tempat, tgl };
}

/** Strip RT/RW pattern from end of address (handles "X : 003/008" or "X 003/008") */
function stripRtRwFromAlamat(alamat: string): string {
  return alamat
    .replace(/\s*[:\s]+\d{2,3}\s*[/\\]\s*\d{2,3}\s*$/, "")
    .replace(/\s+RT\s*[/\\]?\s*RW\s*$/i, "")
    .trim();
}

function parseKTP(rawText: string) {
  const lines  = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fields = buildFieldMap(rawText);

  // ── NIK: 16 digit dari teks penuh (paling reliable) ─────────────────
  let nik = rawText.replace(/\D/g, "").match(/(\d{16})/)?.[1] ?? "";

  // Fallback 1: field NIK raw (tanpa normalisasi)
  if (!isValidNIK(nik)) {
    const fromField = findField(fields, "NIK").replace(/\D/g, "");
    if (isValidNIK(fromField)) nik = fromField;
  }

  // Fallback 2: normalisasi karakter OCR dari field NIK (E→3, O→0, S→5, dll)
  if (!isValidNIK(nik)) {
    const normalized = normalizeNikOcr(findField(fields, "NIK"));
    if (isValidNIK(normalized)) nik = normalized;
  }

  // Fallback 3: normalisasi dari seluruh raw text, ambil 16 digit pertama
  if (!isValidNIK(nik)) {
    const normalizedFull = normalizeNikOcr(rawText).match(/(\d{16})/)?.[1] ?? "";
    if (isValidNIK(normalizedFull)) nik = normalizedFull;
  }

  // ── Provinsi & Kota ─────────────────────────────────────────────────
  let jenisKota = "", kota = "";
  for (const line of lines.slice(0, 5)) {
    const m = line.match(/\b(KOTA|KABUPATEN)\s+([A-Z][A-Z\s]+?)(?:\s*$|\s{2,})/i);
    if (m) {
      const namaKota = m[2].trim();
      // Skip kalau cuma header "KOTA SURABAYA" pas tanggal terbit (yang ada angka di belakang)
      if (!namaKota || /\d/.test(namaKota)) continue;
      jenisKota = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      kota = namaKota;
      break;
    }
  }

  // ── Nama ────────────────────────────────────────────────────────────
  let nama = findField(fields, "NAMA");
  // Validasi: bukan label, bukan kelurahan, bukan tanggal
  if (nama && (/\d{2}[-/]\d{2}/.test(nama) || nama.length < 2)) nama = "";

  // ── Tempat & Tanggal Lahir ──────────────────────────────────────────
  const ttlRaw = findField(fields, "TEMPAT", "TGL LAHIR", "TANGGAL LAHIR");
  let { tempat: tempatLahir, tgl: tglLahir } = parseTTL(ttlRaw);

  // Cross-validate dengan NIK
  if (nik && (!tglLahir || !/^\d{2}-\d{2}-\d{4}$/.test(tglLahir))) {
    const fromNIK = birthDateFromNIK(nik);
    if (fromNIK) tglLahir = fromNIK;
  }

  // Fallback: cari pola tanggal di seluruh teks
  if (!tempatLahir || !tglLahir) {
    for (const line of lines) {
      const m = line.match(/([A-Z][A-Z]+),?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})/);
      if (m) {
        if (!tempatLahir) tempatLahir = m[1];
        if (!tglLahir)    tglLahir    = m[2].replace(/\//g, "-");
        break;
      }
    }
  }

  // ── Jenis Kelamin ───────────────────────────────────────────────────
  let jenisKelamin = "";
  for (const line of lines) {
    if (/\bLAKI[-\s]LAKI\b/i.test(line)) { jenisKelamin = "LAKI-LAKI"; break; }
    if (/\bPEREMPUAN\b/i.test(line))      { jenisKelamin = "PEREMPUAN"; break; }
  }

  // ── RT/RW ───────────────────────────────────────────────────────────
  let rt = "", rw = "";
  // Coba dari field
  const rtRwField = findField(fields, "RT/RW", "RTRW", "RT RW");
  if (rtRwField) {
    const m = rtRwField.match(/(\d{1,3})\s*[/\\]\s*(\d{1,3})/);
    if (m) { rt = m[1].padStart(3, "0"); rw = m[2].padStart(3, "0"); }
  }
  // Fallback: cari pattern NNN/NNN di seluruh teks
  if (!rt) {
    for (const line of lines) {
      const m = line.match(/\b(\d{2,3})\s*[/\\]\s*(\d{2,3})\b/);
      if (m && m[1].length >= 2 && m[2].length >= 2) {
        rt = m[1].padStart(3, "0");
        rw = m[2].padStart(3, "0");
        break;
      }
    }
  }
  const rtRw = rt && rw ? `${rt}/${rw}` : "";

  // ── Alamat ──────────────────────────────────────────────────────────
  let alamat = findField(fields, "ALAMAT");
  // Strip RT/RW yang nyangkut di akhir
  if (alamat) alamat = stripRtRwFromAlamat(alamat);
  // Fallback: cari baris yang dimulai JL./JALAN
  if (!alamat) {
    for (const line of lines) {
      if (/^JL[N]?[.\s]/i.test(line) || /^JALAN\s/i.test(line)) {
        alamat = stripRtRwFromAlamat(line.trim());
        break;
      }
    }
  }

  // ── Kelurahan / Desa ────────────────────────────────────────────────
  const kelurahan = findField(fields, "KEL/DESA", "KEL DESA", "KELURAHAN", "DESA").replace(/^[/\\\s]+/, "").trim();

  // ── Kecamatan ───────────────────────────────────────────────────────
  const kecamatan = findField(fields, "KECAMATAN");

  // ── Agama ───────────────────────────────────────────────────────────
  const agama = findField(fields, "AGAMA");

  // ── Status Perkawinan ───────────────────────────────────────────────
  const statusKawin = findField(fields, "STATUS PERKAWINAN", "STATUS KAWIN");

  // ── Pekerjaan ───────────────────────────────────────────────────────
  const pekerjaan = findField(fields, "PEKERJAAN");

  // ── Kewarganegaraan ─────────────────────────────────────────────────
  const kwn = findField(fields, "KEWARGANEGARAAN");
  const wni = !kwn || /WNI/i.test(kwn) ? "Indonesia" : kwn;

  // ── Berlaku Hingga ──────────────────────────────────────────────────
  const berlaku = findField(fields, "BERLAKU HINGGA", "BERLAKU");

  // ── Alamat lengkap — assembly ───────────────────────────────────────
  const addrParts: string[] = [];
  if (alamat)    addrParts.push(alamat);
  if (rtRw)      addrParts.push(`RT/RW ${rtRw}`);
  if (kelurahan) addrParts.push(`Kel. ${kelurahan}`);
  if (kecamatan) addrParts.push(`Kec. ${kecamatan}`);
  if (kota)      addrParts.push(`${jenisKota} ${kota}`.trim());
  const alamatLengkap = addrParts.join(", ");

  // ── Scoring ─────────────────────────────────────────────────────────
  const coreFields = [nik, nama, tempatLahir, tglLahir, alamatLengkap];
  const filled     = coreFields.filter(Boolean).length;
  const score      = Math.round((filled / coreFields.length) * 100);
  const confidence = score / 100;
  const status: "valid" | "review" | "invalid" =
    score >= 80 ? "valid" : score >= 50 ? "review" : "invalid";

  const warnings: string[] = [];
  if (!nik)                   warnings.push("NIK tidak terdeteksi");
  else if (!isValidNIK(nik))  warnings.push("NIK tidak valid — bukan 16 digit");
  if (!nama)                  warnings.push("Nama tidak terbaca — isi manual");
  if (!alamatLengkap)         warnings.push("Alamat tidak terdeteksi");

  return {
    raw_text:     rawText,
    cleaned_text: [nama, nik ? `NIK ${nik}` : ""].filter(Boolean).join(" | "),
    confidence,
    parsed: {
      nama,
      nik,
      tempat_lahir:   tempatLahir,
      tanggal_lahir:  tglLahir,
      alamat_lengkap: alamatLengkap,
    },
    score,
    status,
    warnings,
    extracted_full: {
      kelamin: jenisKelamin,
      agama,
      status_kawin: statusKawin,
      pekerjaan,
      warga_negara: wni,
      berlaku_hingga: berlaku,
      kelurahan,
      kecamatan,
      kota,
      jenis_kota: jenisKota,
      rt_rw: rtRw,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Route Handler
// ════════════════════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ detail: "File KTP wajib diupload" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { detail: "Format file harus gambar (JPG, PNG, atau WEBP)" },
        { status: 400 },
      );
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ detail: "Ukuran file maksimal 20MB" }, { status: 400 });
    }

    const buffer  = Buffer.from(await file.arrayBuffer());
    const rawText = await extractText(buffer);

    if (!rawText.trim()) {
      return NextResponse.json({
        raw_text: "", cleaned_text: "", confidence: 0,
        parsed: emptyParsed(), score: 0, status: "invalid",
        warnings: ["Tidak ada teks terdeteksi — pastikan gambar jelas dan terang"],
      });
    }

    const result = parseKTP(rawText);

    if (!result.parsed.nik && result.score < 20) {
      return NextResponse.json({
        ...result, status: "invalid",
        warnings: ["Gambar tidak terdeteksi sebagai KTP Indonesia yang valid"],
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const e   = err as { status?: number; message?: string };
    const msg = e?.message ?? "";
    console.error("OCR KTP Vision error:", err);

    if (e?.status === 403 || msg.includes("PERMISSION_DENIED")) {
      return NextResponse.json(
        { detail: "Service account tidak punya akses Vision API. Aktifkan Cloud Vision API di Google Cloud Console." },
        { status: 403 },
      );
    }
    if (msg.includes("GOOGLE_APPLICATION_CREDENTIALS") || msg.includes("credentials")) {
      return NextResponse.json(
        { detail: "File service account tidak ditemukan atau tidak valid." },
        { status: 500 },
      );
    }
    if (e?.status === 429) {
      return NextResponse.json(
        { detail: "Quota Vision API habis." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { detail: "OCR gagal — coba upload ulang dengan gambar yang lebih jelas" },
      { status: 500 },
    );
  }
}

function emptyParsed() {
  return { nama: "", nik: "", tempat_lahir: "", tanggal_lahir: "", alamat_lengkap: "" };
}
