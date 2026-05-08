export async function ocrRisalah(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/surat/ocr-risalah", {
    method: "POST",
    body: formData,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error((json as { detail?: string })?.detail ?? "Gagal OCR Risalah");
  }

  return json;
}