const OCR_API_BASE_URL =
  process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";

export type OcrRisalahLelangResult = {
  rawText: string;
  cleanedText: string;
  confidence: number;
  parsed: {
    nomor_risalahlelang: string;
    tanggal_risalahlelang: string;
    pejabat_lelang: string;
    jamlelang: string;
    NIP: string;
    uraian: string;
  };
  score: number;
  status: "valid" | "review" | "invalid";
  warnings: string[];
};

export async function ocrRisalahLelang(file: File): Promise<OcrRisalahLelangResult> {
  if (file.type !== "application/pdf") {
    throw new Error("File risalah lelang harus berformat PDF.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${OCR_API_BASE_URL}/api/ocr/risalah`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = "Gagal memproses Risalah Lelang";
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
  const p = json.parsed ?? {};

  return {
    rawText: json.raw_text || "",
    cleanedText: json.cleaned_text || "",
    confidence: Number(json.confidence || 0),
    parsed: {
      nomor_risalahlelang: p.nomor_risalah || "",
      tanggal_risalahlelang: p.tanggal_risalah || "",
      pejabat_lelang: p.pejabat_lelang || "",
      jamlelang: p.jam_lelang || "",
      NIP: p.nip || "",
      uraian: p.uraian || "",
    },
    score: Number(json.score || 0),
    status: json.status || "invalid",
    warnings: Array.isArray(json.warnings) ? json.warnings : [],
  };
}
