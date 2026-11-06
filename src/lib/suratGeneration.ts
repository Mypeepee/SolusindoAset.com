/** Shared form/API contract for the three letters without a specialised workflow. */
export type SuratValues = Record<string, string>;
export type SuratField = {
  key: string;
  label: string;
  section: string;
  required?: boolean;
  type?: "textarea" | "number";
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
    { ...field("tanggal_surat", "Tanggal surat", "Data surat"), placeholder: "YYYY-MM-DD" },
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
    field("kelamin_pemohon", "Jenis kelamin", "Data pemohon"),
    field("agama_pemohon", "Agama", "Data pemohon"),
    field("warga_negara", "Kewarganegaraan", "Data pemohon"),
    field("pekerjaan_pemohon", "Pekerjaan", "Data pemohon"),
    field("statuskawin_pemohon", "Status perkawinan", "Data pemohon"),
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
    field("nomor_risalah", "Nomor risalah", "Data lelang"),
    field("tanggal_risalah", "Tanggal risalah", "Data lelang"),
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
  }
  if (id === "permohonan-akte-grosse" && !["sendiri", "kuasa"].includes(values.bertindakSebagai))
    errors.bertindakSebagai = "Pilih atas nama sendiri atau menggunakan kuasa.";
  // The supplied PN document is signed by the applicant and contains no power-of-attorney clause.
  if (id === "permohonan-eksekusi-pn" && values.bertindakSebagai && values.bertindakSebagai !== "sendiri")
    errors.bertindakSebagai = "Template PN yang tersedia ditandatangani langsung oleh pemohon.";
  return errors;
}

/** Use the actual OCR contract; empty scan results must not erase manually entered data. */
export function ktpSuratPatch(parsed: Record<string, unknown>, pihak: string): SuratValues {
  const keys: Record<string, string> = {
    nama_pemohon: "nama", nik_pemohon: "nik", kotalahir_pemohon: "tempatlahir",
    tanggallahir_pemohon: "tanggallahir", alamat_pemohon: "alamat", kelamin_pemohon: "kelamin",
    agama_pemohon: "agama", pekerjaan_pemohon: "pekerjaan", statuskawin_pemohon: "statuskawin",
  };
  const patch: SuratValues = {};
  for (const [key, target] of Object.entries(keys)) {
    if (typeof parsed[key] === "string" && parsed[key].trim()) patch[`${target}_${pihak}`] = parsed[key].trim();
  }
  if (pihak === "pemohon" && typeof parsed.warga_negara === "string" && parsed.warga_negara.trim())
    patch.warga_negara = parsed.warga_negara.trim();
  return patch;
}
