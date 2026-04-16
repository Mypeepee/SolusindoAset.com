import {
  FileText,
  Users,
  PenLine,
  Folder,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Legacy stub types (used by unused components, kept for TS compat) ────────

import type { LucideIcon as _LI } from "lucide-react";

export type SuratCategory = {
  id: string;
  label: string;
  icon: _LI;
  total: number;
  active?: boolean;
};

export type SuratRecentDocument = {
  id: string;
  title: string;
  templateCode: string;
  createdAt: string;
  editedAt: string;
  editor: string;
  category: string;
  icon: _LI;
  status: "Final" | "Draft" | "Review";
};

// ─── Base Types ───────────────────────────────────────────────────────────────

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

// ─── Phase System ─────────────────────────────────────────────────────────────

export type SuratPhase =
  | "pra-kesepakatan"
  | "pengurusan-dokumen"
  | "eksekusi";

export type SuratPhaseConfig = {
  id: SuratPhase;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  // Phase selector card
  numberColor: string;
  activeBorder: string;
  activeBg: string;
  activeGlow: string;
  badgeClasses: string;
  dotColor: string;
  // Template card
  iconClasses: string;
  cardHover: string;
  accentLine: string;
};

export const suratPhases: SuratPhaseConfig[] = [
  {
    id: "pra-kesepakatan",
    number: "01",
    title: "Pra-Kesepakatan",
    subtitle: "MOU & Perjanjian",
    description:
      "Dokumen sebelum kesepakatan jasa: PKS, surat kuasa jual, dan pernyataan pemilik aset.",
    numberColor: "text-amber-400",
    activeBorder: "border-amber-500/30",
    activeBg: "bg-amber-950/20",
    activeGlow: "shadow-[0_0_50px_-20px_rgba(245,158,11,0.3)]",
    badgeClasses: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    dotColor: "bg-amber-400",
    iconClasses: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    cardHover:
      "hover:border-amber-500/20 hover:shadow-[0_12px_40px_-20px_rgba(245,158,11,0.2)]",
    accentLine: "bg-gradient-to-r from-transparent via-amber-500/50 to-transparent",
  },
  {
    id: "pengurusan-dokumen",
    number: "02",
    title: "Pengurusan Dokumen",
    subtitle: "Pasca Lelang",
    description:
      "Dokumen pengurusan setelah pemenang lelang ditetapkan: AJB, balik nama, dan sertifikasi.",
    numberColor: "text-sky-400",
    activeBorder: "border-sky-500/30",
    activeBg: "bg-sky-950/20",
    activeGlow: "shadow-[0_0_50px_-20px_rgba(14,165,233,0.3)]",
    badgeClasses: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    dotColor: "bg-sky-400",
    iconClasses: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    cardHover:
      "hover:border-sky-500/20 hover:shadow-[0_12px_40px_-20px_rgba(14,165,233,0.2)]",
    accentLine: "bg-gradient-to-r from-transparent via-sky-500/50 to-transparent",
  },
  {
    id: "eksekusi",
    number: "03",
    title: "Eksekusi Pengosongan",
    subtitle: "Litigasi & Eksekusi",
    description:
      "Surat permohonan eksekusi, somasi pengosongan, dan dokumen litigasi ke Pengadilan Negeri.",
    numberColor: "text-violet-400",
    activeBorder: "border-violet-500/30",
    activeBg: "bg-violet-950/20",
    activeGlow: "shadow-[0_0_50px_-20px_rgba(139,92,246,0.3)]",
    badgeClasses: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    dotColor: "bg-violet-400",
    iconClasses: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    cardHover:
      "hover:border-violet-500/20 hover:shadow-[0_12px_40px_-20px_rgba(139,92,246,0.2)]",
    accentLine:
      "bg-gradient-to-r from-transparent via-violet-500/50 to-transparent",
  },
];

// ─── Template Type ─────────────────────────────────────────────────────────────

export type SuratTemplate = {
  id: string;
  code: string;
  title: string;
  category: string;
  phase: SuratPhase;
  description: string;
  status: SuratTemplateStatus;
  updatedAt: string;
  usedCount: number;
  icon: LucideIcon;
  templateFileName: string;
  fields: SuratField[];
  comingSoon?: boolean;
};

// ─── Wizard ────────────────────────────────────────────────────────────────────

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

// ─── Templates ─────────────────────────────────────────────────────────────────

export const suratTemplates: SuratTemplate[] = [
  // ── Phase 1: Pra-Kesepakatan ────────────────────────────────────────────────
  {
    id: "pks-jasa-pemasaran",
    code: "PKS-001",
    title: "Perjanjian Kerjasama Jasa Pemasaran",
    category: "Pra-Kesepakatan",
    phase: "pra-kesepakatan",
    description:
      "Template PKS antara balai lelang dengan pemilik aset untuk jasa pemasaran dan penjualan objek melalui mekanisme lelang.",
    status: "Baru",
    updatedAt: "13 Apr 2026",
    usedCount: 0,
    icon: Users,
    templateFileName: "Template_PKS_Jasa_Pemasaran.docx",
    fields: [],
    comingSoon: true,
  },
  {
    id: "surat-kuasa-jual",
    code: "PKS-002",
    title: "Surat Kuasa Penjualan Objek Lelang",
    category: "Pra-Kesepakatan",
    phase: "pra-kesepakatan",
    description:
      "Surat kuasa dari pemilik objek kepada balai lelang untuk menjual aset melalui proses lelang, termasuk penandatanganan akta.",
    status: "Standar",
    updatedAt: "13 Apr 2026",
    usedCount: 0,
    icon: PenLine,
    templateFileName: "Template_Surat_Kuasa_Jual.docx",
    fields: [],
    comingSoon: true,
  },

  // ── Phase 2: Pengurusan Dokumen ─────────────────────────────────────────────
  {
    id: "permohonan-akte-grosse",
    code: "DOK-003",
    title: "Permohonan Akte Grosse",
    category: "Pengurusan Dokumen",
    phase: "pengurusan-dokumen",
    description:
      "Permohonan penerbitan akte grosse kepada notaris perjanjian kredit oleh pemenang lelang.",
    status: "Baru",
    updatedAt: "15 Apr 2026",
    usedCount: 0,
    icon: PenLine,
    templateFileName: "Permohonan_Akta_Grosse.docx",
    fields: [],
    comingSoon: false,
  },
  {
    id: "pengantar-ajb",
    code: "DOK-001",
    title: "Surat Pengantar Pengurusan AJB",
    category: "Pengurusan Dokumen",
    phase: "pengurusan-dokumen",
    description:
      "Surat pengantar ke notaris untuk pengurusan Akta Jual Beli (AJB) setelah pemenang lelang ditetapkan dan pelunasan dilakukan.",
    status: "Baru",
    updatedAt: "13 Apr 2026",
    usedCount: 0,
    icon: Folder,
    templateFileName: "Template_Pengantar_AJB.docx",
    fields: [],
    comingSoon: true,
  },
  {
    id: "permohonan-balik-nama",
    code: "DOK-002",
    title: "Surat Permohonan Balik Nama",
    category: "Pengurusan Dokumen",
    phase: "pengurusan-dokumen",
    description:
      "Surat permohonan balik nama sertifikat dari nama debitur ke nama pemenang lelang di kantor BPN setempat.",
    status: "Standar",
    updatedAt: "13 Apr 2026",
    usedCount: 0,
    icon: FileCheck,
    templateFileName: "Template_Balik_Nama.docx",
    fields: [],
    comingSoon: true,
  },

  // ── Phase 3: Eksekusi Pengosongan ───────────────────────────────────────────
  {
    id: "permohonan-eksekusi-pn",
    code: "LIT-001",
    title: "Permohonan Eksekusi",
    category: "Litigasi Perdata",
    phase: "eksekusi",
    description:
      "Template permohonan eksekusi pengosongan / pelaksanaan eksekusi ke Pengadilan Negeri. Alur input dibuat bertahap: pilih kuasa, scan KTP debitur, lalu isi data asset dan data lelang.",
    status: "Baru",
    updatedAt: "04 Apr 2026",
    usedCount: 0,
    icon: FileText,
    templateFileName: "Template_permohonan_PN.docx",
    fields: [
      {
        key: "selected_kuasa_id",
        label: "Pilih Kuasa",
        type: "select",
        section: "kuasa",
        required: true,
        options: kuasaOptions.map((item) => ({
          label: item.label,
          value: item.id,
        })),
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
        key: "tanggal_surat",
        label: "Tanggal Surat",
        type: "date",
        section: "surat",
        required: true,
      },
      {
        key: "alamat_PN",
        label: "Alamat Pengadilan Negeri",
        type: "textarea",
        section: "surat",
        required: true,
        placeholder: "Contoh: Jl. Raya Arjuno No. 16-18",
      },
      {
        key: "alamat_pn",
        label: "Alamat PN (Lampiran)",
        type: "textarea",
        section: "lampiran",
        placeholder: "Alamat lengkap PN untuk bagian alat bukti",
      },
      {
        key: "kecamatan",
        label: "Kecamatan PN",
        type: "text",
        section: "lampiran",
        placeholder: "Contoh: Sawahan",
      },
      {
        key: "provinsi",
        label: "Provinsi",
        type: "text",
        section: "lampiran",
        placeholder: "Contoh: Jawa Timur",
      },
      {
        key: "kode_pos",
        label: "Kode Pos",
        type: "text",
        section: "lampiran",
        placeholder: "Contoh: 60251",
      },

      {
        key: "nama_kuasa",
        label: "Nama Kuasa",
        type: "text",
        section: "kuasa",
        required: true,
        readOnly: true,
      },
      {
        key: "nik_kuasa",
        label: "NIK Kuasa",
        type: "text",
        section: "kuasa",
        required: true,
        readOnly: true,
      },
      {
        key: "kotalahir_kuasa",
        label: "Kota Lahir Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "tanggallahir_kuasa",
        label: "Tanggal Lahir Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "kelamin_kuasa",
        label: "Jenis Kelamin Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "agama_kuasa",
        label: "Agama Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "alamat_kuasa",
        label: "Alamat Kuasa",
        type: "textarea",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "pekerjaan_kuasa",
        label: "Pekerjaan Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },
      {
        key: "statuskawin_kuasa",
        label: "Status Kawin Kuasa",
        type: "text",
        section: "kuasa",
        readOnly: true,
      },

      {
        key: "nama_pemohon",
        label: "Nama Pemohon",
        type: "text",
        section: "pemohon",
        required: true,
        placeholder: "Nama pemilik / pemberi kuasa",
      },
      {
        key: "nik_pemohon",
        label: "NIK Pemohon",
        type: "text",
        section: "pemohon",
        required: true,
      },
      {
        key: "kotalahir_pemohon",
        label: "Kota Lahir Pemohon",
        type: "text",
        section: "pemohon",
      },
      {
        key: "tanggallahir_pemohon",
        label: "Tanggal Lahir Pemohon",
        type: "text",
        section: "pemohon",
        placeholder: "Contoh: 18 Oktober 1983",
      },
      {
        key: "kelamin_pemohon",
        label: "Jenis Kelamin Pemohon",
        type: "select",
        section: "pemohon",
        options: [
          { label: "Laki-Laki", value: "Laki-Laki" },
          { label: "Perempuan", value: "Perempuan" },
        ],
      },
      {
        key: "agama_pemohon",
        label: "Agama Pemohon",
        type: "text",
        section: "pemohon",
      },
      {
        key: "alamat_pemohon",
        label: "Alamat Pemohon",
        type: "textarea",
        section: "pemohon",
      },
      {
        key: "pekerjaan_pemohon",
        label: "Pekerjaan Pemohon",
        type: "text",
        section: "pemohon",
      },
      {
        key: "statuskawin_pemohon",
        label: "Status Kawin Pemohon",
        type: "text",
        section: "pemohon",
      },

      {
        key: "ktp_debitur_file",
        label: "Foto KTP Debitur",
        type: "file",
        section: "debitur",
        helperText: "Upload foto KTP agar nama dan alamat debitur bisa diprefill.",
      },
      {
        key: "nama_debitur",
        label: "Nama Debitur / Termohon",
        type: "text",
        section: "debitur",
        required: true,
        placeholder: "Hasil scan KTP / koreksi manual",
      },
      {
        key: "nik_debitur",
        label: "NIK Debitur",
        type: "text",
        section: "debitur",
        placeholder: "Opsional, untuk arsip internal",
      },
      {
        key: "alamat_debitur",
        label: "Alamat Debitur",
        type: "textarea",
        section: "debitur",
        placeholder: "Hasil scan KTP / koreksi manual",
      },

      {
        key: "jenis_sertifikat",
        label: "Jenis Sertifikat",
        type: "text",
        section: "asset",
        required: true,
        placeholder: "Contoh: Sertipikat Hak Guna Bangunan",
      },
      {
        key: "singkatan_sertifikat",
        label: "Singkatan Sertifikat",
        type: "text",
        section: "asset",
        required: true,
        placeholder: "Contoh: SHGB",
      },
      {
        key: "nomor_nib",
        label: "Nomor NIB",
        type: "text",
        section: "asset",
        required: true,
      },
      {
        key: "LT",
        label: "Luas Tanah (m²)",
        type: "number",
        section: "asset",
        required: true,
      },
      {
        key: "lokasi_asset",
        label: "Lokasi Asset",
        type: "textarea",
        section: "asset",
        required: true,
        placeholder: "Alamat lengkap objek",
      },
      {
        key: "kelurahan_asset",
        label: "Kelurahan Asset",
        type: "text",
        section: "asset",
        required: true,
      },
      {
        key: "kecamatan_asset",
        label: "Kecamatan Asset",
        type: "text",
        section: "asset",
        required: true,
      },
      {
        key: "kota_asset",
        label: "Kota Asset",
        type: "text",
        section: "asset",
        required: true,
      },

      {
        key: "nama_bank",
        label: "Nama Bank",
        type: "text",
        section: "lelang",
        required: true,
        placeholder: "Contoh: Pt. Bank Rakyat Indonesia (Persero), Tbk",
      },
      {
        key: "nomor_risalah",
        label: "Nomor Risalah",
        type: "text",
        section: "lelang",
        required: true,
      },
      {
        key: "tanggal_risalah",
        label: "Tanggal Risalah",
        type: "text",
        section: "lelang",
        required: true,
        placeholder: "Contoh: 17 November 2025",
      },
      {
        key: "nomor_kwitansi",
        label: "Nomor Kwitansi",
        type: "text",
        section: "lelang",
        required: true,
      },
      {
        key: "tanggal_kwitansi",
        label: "Tanggal Kwitansi",
        type: "text",
        section: "lelang",
        required: true,
        placeholder: "Contoh: 17 November 2025",
      },
    ],
  },
  {
    id: "somasi-pengosongan",
    code: "LIT-002",
    title: "Somasi Pengosongan",
    category: "Litigasi Perdata",
    phase: "eksekusi",
    description:
      "Somasi resmi kepada penghuni objek lelang untuk segera mengosongkan properti sebelum eksekusi pengosongan dilaksanakan oleh Pengadilan Negeri.",
    status: "Standar",
    updatedAt: "13 Apr 2026",
    usedCount: 0,
    icon: AlertCircle,
    templateFileName: "Template_Somasi_Pengosongan.docx",
    fields: [],
    comingSoon: true,
  },
  {
    id: "akta-kesepakatan-bersama",
    code: "LIT-003",
    title: "Akta Kesepakatan Bersama",
    category: "Litigasi Perdata",
    phase: "eksekusi",
    description:
      "Akta perdamaian / mediasi antara pemenang lelang dengan penghuni lama untuk pengosongan sukarela dengan kompensasi. Dibuat sebelum proses eksekusi paksa melalui Pengadilan Negeri.",
    status: "Baru",
    updatedAt: "15 Apr 2026",
    usedCount: 0,
    icon: FileCheck,
    templateFileName: "Akta_kesepakatan_bersama_perdamaian.docx",
    fields: [],
    comingSoon: false,
  },
];
