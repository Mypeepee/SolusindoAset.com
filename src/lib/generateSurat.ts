const OCR_API_BASE_URL =
  process.env.NEXT_PUBLIC_OCR_API_URL || "http://localhost:8000";

export type GenerateSuratResult = {
  blob: Blob;
  filename: string;
  isPdf: boolean;
};

export async function generateSurat(
  templateFile: string,
  values: Record<string, string>,
): Promise<GenerateSuratResult> {
  const res = await fetch(`${OCR_API_BASE_URL}/api/generate/surat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_file: templateFile, values }),
  });

  if (!res.ok) {
    let message = "Gagal generate surat";
    try {
      const errJson = await res.json();
      message = errJson.detail || message;
    } catch {
      message = (await res.text().catch(() => "")) || message;
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  const isPdf = contentType.includes("pdf");
  const blob = await res.blob();

  // Extract filename from Content-Disposition: attachment; filename="..."
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? (isPdf ? "surat.pdf" : "surat.docx");

  return { blob, filename, isPdf };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
