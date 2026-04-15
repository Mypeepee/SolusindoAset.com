const OCR_API_BASE_URL =
  process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";

export type OcrRisalahResult = {
  rawText: string;
  cleanedText: string;
  confidence: number;
  parsed: {
    nomor_kwitansi: string;
    nomor_risalah_lelang: string;
    tanggal_risalah: string;
    luas: string;
    alamat_desa: string;
    alamat_kecamatan: string;
    alamat_kota: string;
    alamat_provinsi: string;
    no_sertifikat: string;
    tanggal_kwitansi: string;
    nama_bank: string;
    singkatan_sertifikat: string;
    jenis_sertifikat: string;
    nomor_nib: string;
  };
  score: number;
  status: "valid" | "review" | "invalid";
  warnings: string[];
};

export async function ocrRisalah(file: File): Promise<OcrRisalahResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${OCR_API_BASE_URL}/api/ocr/kwitansi`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = "Gagal OCR Kwitansi";

    try {
      const errJson = await res.json();
      message = errJson.detail || message;
    } catch {
      const text = await res.text().catch(() => "");
      message = text || message;
    }

    throw new Error(message);
  }

  const json = await res.json();

  return {
    rawText: json.raw_text || "",
    cleanedText: json.cleaned_text || "",
    confidence: Number(json.confidence || 0),
    parsed: json.parsed || {
      nomor_kwitansi: "",
      nomor_risalah_lelang: "",
      tanggal_risalah: "",
      luas: "",
      alamat_desa: "",
      alamat_kecamatan: "",
      alamat_kota: "",
      alamat_provinsi: "",
      no_sertifikat: "",
      tanggal_kwitansi: "",
      nama_bank: "",
      singkatan_sertifikat: "",
      jenis_sertifikat: "",
      nomor_nib: "",
    },
    score: Number(json.score || 0),
    status: json.status || "invalid",
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
  };
}