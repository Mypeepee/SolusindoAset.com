/** Shared form/API contract for the three letters without a specialised workflow. */
export type SuratValues = Record<string, string>;
export type SuratField = {
  key: string;
  label: string;
  section: string;
  required?: boolean;
  type?: "textarea" | "number" | "date";
  placeholder?: string;
};

export const SURAT_ENDPOINTS: Record<string, string> = {
  "permohonan-eksekusi-pn": "/api/surat/generate-permohonan-pn",
  "permohonan-akte-grosse": "/api/surat/generate-akta-grosse",
  "mou-transaksi": "/api/surat/generate-MOU",
};

export function tanggalWib(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function tanggalSuratValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatTanggalSurat(value: string): string {
  if (!tanggalSuratValid(value)) throw new Error("Tanggal surat harus berupa tanggal valid (YYYY-MM-DD).");
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

const BULAN_SINGKAT_SURAT_KUASA = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

export function nomorSuratKuasaDefault(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-\d{2}$/);
  const month = match ? Number(match[2]) : 0;
  return match && month >= 1 && month <= 12
    ? `1/SKP/${BULAN_SINGKAT_SURAT_KUASA[month - 1]}/${match[1]}`
    : "";
}

const field = (key: string, label: string, section: string, type?: SuratField["type"]): SuratField =>
  ({ key, label, section, type, required: true });

const identitas = (pihak: "pemohon" | "kuasa") => [
  field(`nama_${pihak}`, "Nama lengkap", `Data ${pihak}`),
  field(`nik_${pihak}`, "NIK (16 digit)", `Data ${pihak}`),
  field(`tempatlahir_${pihak}`, "Tempat lahir", `Data ${pihak}`),
  field(`tanggallahir_${pihak}`, "Tanggal lahir", `Data ${pihak}`),
  field(`alamat_${pihak}`, "Alamat lengkap", `Data ${pihak}`, "textarea"),
];

export function suratFields(id: string, values: SuratValues = {}): SuratField[] {
  if (id === "mou-transaksi") return [
    field("id_transaksi", "ID / kode transaksi MOU", "Data MOU"),
    { key: "nama_klien", label: "Nama klien", section: "Koreksi identitas (opsional)" },
    { key: "nik_klien", label: "NIK klien (16 digit)", section: "Koreksi identitas (opsional)" },
    { key: "alamat_klien", label: "Alamat klien", section: "Koreksi identitas (opsional)", type: "textarea" },
  ];

  const surat = [
    field("kota", "Kota penandatanganan", "Data surat"),
    { ...field("tanggal_surat", "Tanggal surat", "Data surat", "date"), placeholder: "YYYY-MM-DD" },
    field("pengadilan", "Nama Pengadilan Negeri", "Data surat"),
  ];
  if (id === "permohonan-akte-grosse") return [
    ...surat,
    field("kpknl", "Nama KPKNL tujuan", "Data surat"),
    field("objek", "Objek lelang", "Data surat"),
    ...identitas("pemohon"),
    ...(values.bertindakSebagai === "kuasa" ? identitas("kuasa").filter(f =>
      !["alamat_kuasa", "tempatlahir_kuasa"].includes(f.key)) : []),
    field("nomor_risalah", "Nomor risalah", "Data risalah lelang"),
    field("tanggal_risalah", "Tanggal risalah", "Data risalah lelang"),
    field("pejabat_lelang", "Pejabat lelang", "Data risalah lelang"),
    field("pukul_lelang", "Pukul lelang", "Data risalah lelang"),
    field("nip_pejabat", "NIP pejabat", "Data risalah lelang"),
  ];

  if (id === "permohonan-eksekusi-pn") return [
    ...surat,
    field("alamat_PN", "Alamat Pengadilan Negeri", "Data surat", "textarea"),
    ...identitas("pemohon"),
    ...(values.bertindakSebagai === "kuasa" ? identitas("kuasa") : []),
    field("kelamin_pemohon", "Jenis kelamin", "Data pemohon"),
    field("agama_pemohon", "Agama", "Data pemohon"),
    field("warga_negara", "Kewarganegaraan", "Data pemohon"),
    field("pekerjaan_pemohon", "Pekerjaan", "Data pemohon"),
    field("statuskawin_pemohon", "Status perkawinan", "Data pemohon"),
    ...(values.bertindakSebagai === "kuasa" ? [
      field("kelamin_kuasa", "Jenis kelamin", "Data kuasa"),
      field("agama_kuasa", "Agama", "Data kuasa"),
      field("warga_negara_kuasa", "Kewarganegaraan", "Data kuasa"),
      field("pekerjaan_kuasa", "Pekerjaan", "Data kuasa"),
      field("statuskawin_kuasa", "Status perkawinan", "Data kuasa"),
      { ...field("nomor_surat_kuasa", "Nomor surat kuasa", "Data surat kuasa"), placeholder: "1/SKP/NOV/2026" },
      { ...field("tanggal_surat_kuasa", "Tanggal surat kuasa", "Data surat kuasa", "date"), placeholder: "YYYY-MM-DD" },
    ] : []),
    field("nama_debitur", "Nama debitur / termohon", "Data debitur"),
    field("alamat_debitur", "Alamat debitur / termohon", "Data debitur", "textarea"),
    field("jenis_sertifikat", "Jenis sertifikat", "Data aset"),
    field("singkatan_sertifikat", "Singkatan sertifikat", "Data aset"),
    field("nomor_nib", "Nomor NIB / sertifikat", "Data aset"),
    field("LT", "Luas tanah (m²)", "Data aset", "number"),
    field("lokasi_asset", "Alamat aset", "Data aset", "textarea"),
    field("kelurahan_asset", "Desa / kelurahan aset", "Data aset"),
    field("kecamatan_asset", "Kecamatan aset", "Data aset"),
    field("kota_asset", "Kota / kabupaten aset", "Data aset"),
    field("nama_bank", "Nama bank", "Data lelang"),
    field("kantor_lelang", "Kantor lelang", "Data lelang"),
    field("nomor_risalah", "Nomor risalah", "Data risalah lelang"),
    field("tanggal_risalah", "Tanggal risalah", "Data risalah lelang"),
    field("nomor_kwitansi", "Nomor kuitansi", "Data lelang"),
    field("tanggal_kwitansi", "Tanggal kuitansi", "Data lelang"),
  ];
  return [];
}

export function suratErrors(id: string, values: SuratValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!SURAT_ENDPOINTS[id]) return { form: "Jenis surat belum didukung." };
  for (const f of suratFields(id, values)) {
    const value = values[f.key]?.trim() ?? "";
    if (f.required && !value) errors[f.key] = `${f.label} wajib diisi.`;
    else if (value && f.key.startsWith("nik_") && !/^\d{16}$/.test(value))
      errors[f.key] = "NIK harus berisi tepat 16 digit angka.";
    else if (value && f.type === "number" && (!Number.isFinite(Number(value)) || Number(value) <= 0))
      errors[f.key] = `${f.label} harus lebih besar dari nol.`;
    else if (value && f.key === "tanggal_surat" && !tanggalSuratValid(value))
      errors[f.key] = "Gunakan tanggal valid dengan format YYYY-MM-DD.";
    else if (value && f.key === "tanggal_surat_kuasa" && !tanggalSuratValid(value))
      errors[f.key] = "Gunakan tanggal valid dengan format YYYY-MM-DD.";
  }
  if (id === "permohonan-eksekusi-pn" && values.bertindakSebagai === "kuasa") {
    const number = values.nomor_surat_kuasa?.trim() ?? "";
    const match = number.match(/^([1-9]\d*)\/SKP\/(JAN|FEB|MAR|APR|MEI|JUN|JUL|AGU|SEP|OKT|NOV|DES)\/(\d{4})$/);
    if (number && !match) errors.nomor_surat_kuasa = "Gunakan format nomor surat kuasa seperti 1/SKP/NOV/2026.";
    else if (match && tanggalSuratValid(values.tanggal_surat_kuasa ?? "")) {
      const expected = nomorSuratKuasaDefault(values.tanggal_surat_kuasa).split("/");
      if (match[2] !== expected[2] || match[3] !== expected[3])
        errors.nomor_surat_kuasa = "Bulan dan tahun nomor harus sesuai tanggal surat kuasa.";
    }
  }
  if (["permohonan-eksekusi-pn", "permohonan-akte-grosse"].includes(id) && !["sendiri", "kuasa"].includes(values.bertindakSebagai))
    errors.bertindakSebagai = "Pilih atas nama sendiri atau menggunakan kuasa.";
  return errors;
}

/** Use the actual OCR contract; empty scan results must not erase manually entered data. */
export function ktpSuratPatch(parsed: Record<string, unknown>, pihak: string): SuratValues {
  const fields: Record<string, string[]> = {
    nama: ["nama_pemohon", "nama"],
    nik: ["nik_pemohon", "nik"],
    tempatlahir: ["kotalahir_pemohon", "tempat_lahir"],
    tanggallahir: ["tanggallahir_pemohon", "tanggal_lahir"],
    alamat: ["alamat_pemohon", "alamat_lengkap", "alamat"],
    kelamin: ["kelamin_pemohon", "kelamin"],
    agama: ["agama_pemohon", "agama"],
    pekerjaan: ["pekerjaan_pemohon", "pekerjaan"],
    statuskawin: ["statuskawin_pemohon", "status_kawin"],
  };
  const patch: SuratValues = {};
  for (const [target, sources] of Object.entries(fields)) {
    const value = sources.map((key) => parsed[key]).find((item) => typeof item === "string" && item.trim());
    if (typeof value === "string") patch[`${target}_${pihak}`] = value.trim();
  }
  if (typeof parsed.warga_negara === "string" && parsed.warga_negara.trim())
    patch[pihak === "pemohon" ? "warga_negara" : `warga_negara_${pihak}`] = parsed.warga_negara.trim();
  return patch;
}

const BULAN_INDONESIA: Record<string, string> = {
  januari: "01", jan: "01", februari: "02", feb: "02", maret: "03", mar: "03",
  april: "04", apr: "04", mei: "05", juni: "06", jun: "06", juli: "07", jul: "07",
  agustus: "08", agu: "08", september: "09", sep: "09", oktober: "10", okt: "10",
  november: "11", nov: "11", desember: "12", des: "12",
};

function kuitansiDate(value: string): string {
  const numeric = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);
  if (numeric) return `${numeric[1].padStart(2, "0")}-${numeric[2].padStart(2, "0")}-${numeric[3]}`;
  const written = value.match(/\b(\d{1,2})\s+(Januari|Jan|Februari|Feb|Maret|Mar|April|Apr|Mei|Juni|Jun|Juli|Jul|Agustus|Agu|September|Sep|Oktober|Okt|November|Nov|Desember|Des)\s+(\d{4})\b/i);
  if (!written) return "";
  const month = BULAN_INDONESIA[written[2].toLowerCase()];
  return month ? `${written[1].padStart(2, "0")}-${month}-${written[3]}` : "";
}

/** Extract the kuitansi number and date from OCR text; both remain editable. */
export function kuitansiSuratPatch(rawText: string): SuratValues {
  const lines = rawText.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let nomor = "";
  let tanggal = "";

  for (const line of lines) {
    if (!nomor && /(?:kwitansi|kuitansi|kwt)/i.test(line)) {
      const number = line.match(/(?:nomor|no\.?|kwitansi|kuitansi|kwt)\s*(?:(?:kwitansi|kuitansi|kwt)\s*)?(?:nomor|no\.?)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9./_-]*)/i);
      if (number) nomor = number[1].replace(/[;,]$/, "");
    }
    if (!tanggal && /\b(?:tanggal|tgl)\b/i.test(line)) tanggal = kuitansiDate(line);
  }

  if (!nomor) {
    const match = rawText.match(/\b((?:KWT|KW|KUITANSI)[-/A-Z0-9.]+)\b/i);
    if (match) nomor = match[1];
  }
  if (!tanggal) tanggal = kuitansiDate(rawText);

  return {
    ...(nomor ? { nomor_kwitansi: nomor } : {}),
    ...(tanggal ? { tanggal_kwitansi: tanggal } : {}),
  };
}
