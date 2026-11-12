import { FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { suratFields } from "@/lib/suratGeneration";

export type SuratTemplateStatus = "Populer" | "Baru" | "Standar";

export type SuratFieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "select"
  | "file";

export type SuratFieldSection =
  | "surat"
  | "kuasa"
  | "pemohon"
  | "debitur"
  | "asset"
  | "lelang"
  | "lampiran";

export type SuratFieldOption = {
  label: string;
  value: string;
};

export type SuratField = {
  key: string;
  label: string;
  type: SuratFieldType;
  section: SuratFieldSection;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  hiddenInForm?: boolean;
  options?: SuratFieldOption[];
  helperText?: string;
};

export type SuratTemplate = {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  status: SuratTemplateStatus;
  updatedAt: string;
  usedCount: number;
  icon: LucideIcon;
  templateFileName: string;
  fields: SuratField[];
};

export type KuasaOption = {
  id: string;
  label: string;
  nama_kuasa: string;
  nik_kuasa: string;
  kotalahir_kuasa: string;
  tanggallahir_kuasa: string;
  kelamin_kuasa: string;
  agama_kuasa: string;
  alamat_kuasa: string;
  pekerjaan_kuasa: string;
  statuskawin_kuasa: string;
};

export type WizardStepKey = "kuasa" | "debitur" | "asset" | "review";

export type WizardStep = {
  key: WizardStepKey;
  title: string;
  description: string;
};

export const wizardSteps: WizardStep[] = [
  {
    key: "kuasa",
    title: "Pilih Kuasa",
    description: "Pilih kuasa dari daftar yang tersedia dan isi data surat dasar.",
  },
  {
    key: "debitur",
    title: "Debitur",
    description: "Upload foto KTP debitur agar data terisi lebih cepat.",
  },
  {
    key: "asset",
    title: "Asset & Lelang",
    description: "Isi data sertifikat, objek, dan detail lelang.",
  },
  {
    key: "review",
    title: "Review",
    description: "Periksa ulang sebelum generate surat.",
  },
];

export const kuasaOptions: KuasaOption[] = [
  {
    id: "kuasa-a",
    label: "Kuasa A",
    nama_kuasa: "VENATHA TANOTO",
    nik_kuasa: "3316057105990006",
    kotalahir_kuasa: "Blora",
    tanggallahir_kuasa: "31 Mei 1999",
    kelamin_kuasa: "Perempuan",
    agama_kuasa: "Kristen",
    alamat_kuasa: "Simo Katrungan Kidul VII/2A",
    pekerjaan_kuasa: "Advokat",
    statuskawin_kuasa: "Belum Menikah",
  },
  {
    id: "kuasa-b",
    label: "Kuasa B",
    nama_kuasa: "NAMA KUASA B",
    nik_kuasa: "0000000000000000",
    kotalahir_kuasa: "Surabaya",
    tanggallahir_kuasa: "01 Januari 1990",
    kelamin_kuasa: "Laki-Laki",
    agama_kuasa: "Kristen",
    alamat_kuasa: "Alamat Kuasa B",
    pekerjaan_kuasa: "Advokat",
    statuskawin_kuasa: "Menikah",
  },
];

export const suratTemplates: SuratTemplate[] = [
  {
    id: "permohonan-eksekusi-pn",
    code: "LIT-001",
    title: "Permohonan Eksekusi",
    category: "Litigasi Perdata",
    description: "Permohonan eksekusi pengosongan ke Pengadilan Negeri. Isi sebagai pemohon atau penerima kuasa, lalu lengkapi data aset dan lelang dengan bantuan scan dokumen.",
    status: "Baru",
    updatedAt: "04 Apr 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Permohonan_PN_Dinamis.docx",
    fields: suratFields("permohonan-eksekusi-pn", { bertindakSebagai: "sendiri" }).map(field => ({
      ...field, section: "surat" as const, type: field.type ?? "text",
    })),
  },

  // ── Transaksi ─────────────────────────────────────────────────────────────────
  {
    id: "mou-transaksi",
    code: "TRX-003",
    title: "MOU Transaksi",
    category: "Transaksi",
    description: "Buat PDF MOU dari ID atau kode MOU di Transaksi. Skema komisi dan nilai biaya mengikuti data MOU yang tersimpan.",
    status: "Baru",
    updatedAt: "22 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "MOU_Template_persentase_final.docx",
    fields: suratFields("mou-transaksi", { bertindakSebagai: "sendiri" }).map(field => ({
      ...field, section: "surat" as const, type: field.type ?? "text",
    })),
  },
  {
    id: "kuitansi-solusindo",
    code: "TRX-002",
    title: "Kuitansi Pembayaran",
    category: "Transaksi",
    description:
      "Template kuitansi penerimaan pembayaran. Isi nama pembayar, nominal, dan keperluan — sistem generate kuitansi siap cetak.",
    status: "Baru",
    updatedAt: "20 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Kuitansi_Solusindo_Premier.docx",
    fields: [
      { key: "nomor_kuitansi", label: "Nomor Kuitansi", type: "text", section: "surat", required: true, placeholder: "KWT/2026/05/001" },
      { key: "tanggal", label: "Tanggal", type: "date", section: "surat", required: true },
      { key: "kota", label: "Kota", type: "text", section: "surat", required: true, placeholder: "Surabaya" },
      { key: "nama_pembayar", label: "Nama Pembayar", type: "text", section: "pemohon", required: true, placeholder: "Nama lengkap atau perusahaan" },
      { key: "nominal", label: "Nominal (Rp)", type: "number", section: "surat", required: true, placeholder: "5000000" },
      { key: "perihal", label: "Untuk Keperluan", type: "textarea", section: "surat", required: true, placeholder: "Contoh: Pembayaran jasa pengurusan eksekusi aset" },
      { key: "catatan", label: "Catatan", type: "textarea", section: "lampiran", placeholder: "Opsional" },
    ],
  },
  {
    id: "invoice-solusindo",
    code: "TRX-001",
    title: "Invoice Penagihan",
    category: "Transaksi",
    description:
      "Template invoice penagihan jasa hukum untuk klien. Isi data klien, uraian pekerjaan, dan nominal tagihan — sistem akan generate dokumen siap kirim.",
    status: "Baru",
    updatedAt: "19 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Invoice_Solusindo_Premier_Final.docx",
    fields: [
      {
        key: "nomor_invoice",
        label: "Nomor Invoice",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: INV/2026/05/001",
      },
      {
        key: "tanggal_invoice",
        label: "Tanggal Invoice",
        type: "date",
        section: "surat",
        required: true,
      },
      {
        key: "kota",
        label: "Kota",
        type: "text",
        section: "surat",
        required: true,
        placeholder: "Contoh: Surabaya",
      },
      {
        key: "nama_klien",
        label: "Nama Klien / Penerima",
        type: "text",
        section: "pemohon",
        required: true,
        placeholder: "Nama lengkap atau nama perusahaan",
      },
      {
        key: "alamat_klien",
        label: "Alamat Klien",
        type: "textarea",
        section: "pemohon",
        required: true,
        placeholder: "Alamat lengkap klien",
      },
      {
        key: "perihal",
        label: "Perihal / Uraian Pekerjaan",
        type: "textarea",
        section: "surat",
        required: true,
        placeholder: "Contoh: Jasa Konsultasi Hukum Pengurusan Eksekusi Aset",
      },
      {
        key: "nominal_jasa",
        label: "Nominal Jasa (Rp)",
        type: "number",
        section: "surat",
        required: true,
        placeholder: "Contoh: 5000000",
      },
      {
        key: "biaya_lain",
        label: "Biaya Lain-lain (Rp)",
        type: "number",
        section: "surat",
        placeholder: "Opsional",
      },
      {
        key: "catatan",
        label: "Catatan / Keterangan",
        type: "textarea",
        section: "lampiran",
        placeholder: "Catatan tambahan jika ada",
      },
    ],
  },

  // ── Pengurusan Dokumen ────────────────────────────────────────────────────────
  {
    id: "tanda-terima-dokumen",
    code: "PEN-002",
    title: "Tanda Terima Dokumen",
    category: "Pengurusan Dokumen",
    description:
      "Bukti serah terima dokumen properti dari agent ke penerima. Scan KTP penerima untuk auto-isi nama, NIK, dan alamat, pilih properti closing, lalu PDF ter-generate otomatis.",
    status: "Baru",
    updatedAt: "07 Jul 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "TandaTerima_Solusindo.docx",
    fields: [
      { key: "ktp_penerima_file", label: "Foto KTP Penerima", type: "file", section: "debitur", helperText: "Upload KTP agar nama, NIK, dan alamat penerima terisi otomatis." },
      { key: "nama_pemilik", label: "Nama Penerima", type: "text", section: "debitur", required: true, placeholder: "Hasil scan KTP / koreksi manual" },
      { key: "nik_pemilik", label: "NIK Penerima", type: "text", section: "debitur", placeholder: "16 digit NIK" },
      { key: "alamat_pemilik", label: "Alamat Penerima", type: "textarea", section: "debitur", placeholder: "Hasil scan KTP / koreksi manual" },
      { key: "alamat_properti", label: "Alamat Properti", type: "textarea", section: "asset", required: true, placeholder: "Alamat properti closing" },
      { key: "tanggal_ttd", label: "Tanggal Terima", type: "date", section: "surat", required: true },
      { key: "nama_agent", label: "Nama Agent (Yang Menyerahkan)", type: "text", section: "surat", placeholder: "Otomatis dari akun agent" },
      { key: "no_agent", label: "No. Agent / WhatsApp", type: "text", section: "surat", placeholder: "Otomatis dari akun agent" },
    ],
  },
  {
    id: "permohonan-akte-grosse",
    code: "PEN-001",
    title: "Permohonan Akte Grosse",
    category: "Pengurusan Notaris",
    description: "Permohonan penerbitan Grosse Risalah Lelang kepada KPKNL. Dapat dibuat atas nama sendiri atau disertai surat kuasa.",
    status: "Baru",
    updatedAt: "04 Mei 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Permohonan_Akta_Grosse_Dinamis.docx",
    fields: suratFields("permohonan-akte-grosse", { bertindakSebagai: "sendiri" }).map(field => ({
      ...field, section: "surat" as const, type: field.type ?? "text",
    })),
  },

  // ── Eksekusi Pengosongan ──────────────────────────────────────────────────────
  {
    id: "akta-kesepakatan-bersama",
    code: "EKS-001",
    title: "Akta Kesepakatan Bersama",
    category: "Eksekusi Pengosongan",
    description:
      "Akta kesepakatan bersama antara pemenang lelang dan debitur untuk pengosongan aset. Scan KTP kedua pihak + upload risalah lelang, lalu input kompensasi dan tanggal paling lambat pengosongan — PDF ter-generate otomatis.",
    status: "Baru",
    updatedAt: "08 Jul 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Akta_kesepakatan_bersama_TemplateSolusindo.docx",
    fields: [],
  },
  {
    id: "debitur-care",
    code: "EKS-002",
    title: "Debitur Care",
    category: "Eksekusi Pengosongan",
    description:
      "Surat Kuasa + Perjanjian Jasa Hukum untuk debitur yang asetnya menghadapi lelang/pengosongan, tergabung dalam satu PDF. Scan KTP debitur — nama, NIK, tempat/tanggal lahir, pekerjaan, status, dan alamat sampai provinsi terisi otomatis; tinggal lengkapi jenis & nomor sertifikat. Nomor surat (NNN/PJH-INISIAL/BULAN/TAHUN) dipesan server dan tercatat di register.",
    status: "Baru",
    updatedAt: "04 Sep 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "TEMPLATE_DEBITURCARE.docx",
    fields: [],
  },
];
