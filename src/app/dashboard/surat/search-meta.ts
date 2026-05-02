export type SuratMeta = {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  status: string;
};

export const suratSearchMeta: SuratMeta[] = [
  {
    id: "permohonan-eksekusi-pn",
    code: "LIT-001",
    title: "Permohonan Eksekusi",
    category: "Litigasi Perdata",
    description:
      "Template permohonan eksekusi pengosongan / pelaksanaan eksekusi ke Pengadilan Negeri.",
    status: "Baru",
  },
];
