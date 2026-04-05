import { FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
        placeholder: "Contoh: Bank Rakyat Indonesia",
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
];