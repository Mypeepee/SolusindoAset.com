const OCR_API_BASE_URL =
  process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";

export type OcrKtpResult = {
  rawText: string;
  cleanedText: string;
  confidence: number;
  parsed: {
    nama_pemohon: string;
    nik_pemohon: string;
    kotalahir_pemohon: string;
    tanggallahir_pemohon: string;
    kelamin_pemohon: string;
    agama_pemohon: string;
    alamat_pemohon: string;
    alamat_utama_pemohon: string;
    kelurahan_pemohon: string;
    kecamatan_pemohon: string;
    kota_pemohon: string;
    jenis_kota_pemohon: string;
    rt_rw_pemohon: string;
    pekerjaan_pemohon: string;
    statuskawin_pemohon: string;
    warga_negara: string;
  };
  score: number;
  status: "valid" | "review" | "invalid";
  warnings: string[];
};

export async function ocrKTP(file: File): Promise<OcrKtpResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${OCR_API_BASE_URL}/api/ocr/ktp`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = "Gagal OCR KTP";

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
      nama_pemohon: "",
      nik_pemohon: "",
      kotalahir_pemohon: "",
      tanggallahir_pemohon: "",
      kelamin_pemohon: "",
      agama_pemohon: "",
      alamat_pemohon: "",
      alamat_utama_pemohon: "",
      kelurahan_pemohon: "",
      kecamatan_pemohon: "",
      kota_pemohon: "",
      jenis_kota_pemohon: "",
      rt_rw_pemohon: "",
      pekerjaan_pemohon: "",
      statuskawin_pemohon: "",
      warga_negara: "Indonesia",
    },
    score: Number(json.score || 0),
    status: json.status || "invalid",
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
  };
}