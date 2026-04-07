export async function ocrRisalah(file: File) {
    const formData = new FormData();
    formData.append("file", file);
  
    const res = await fetch("http://127.0.0.1:8000/api/ocr/risalah", {
      method: "POST",
      body: formData,
    });
  
    const json = await res.json();
  
    if (!res.ok) {
      throw new Error(json?.detail || "Gagal OCR Risalah");
    }
  
    return json;
  }