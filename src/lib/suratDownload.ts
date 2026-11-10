/** Request a PDF and keep its object URL alive until the browser has begun downloading. */
export async function downloadSurat(endpoint: string, values: Record<string, unknown>, fallback: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values), signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { detail?: unknown; error?: unknown };
      const message = typeof body.detail === "string" ? body.detail : typeof body.error === "string" ? body.error : "";
      if (response.status === 401) throw new Error("Sesi login berakhir. Masuk kembali lalu coba lagi; isian Anda tetap tersedia di form ini.");
      throw new Error(message || `Gagal membuat dokumen (HTTP ${response.status}). Coba lagi.`);
    }
    const blob = await response.blob();
    const signature = await blob.slice(0, 5).text();
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/pdf") || signature !== "%PDF-")
      throw new Error("Server tidak mengirim PDF yang valid. Dokumen belum diunduh; silakan coba lagi.");

    const disposition = response.headers.get("content-disposition") ?? "";
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    let filename = disposition.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
    if (utf8) { try { filename = decodeURIComponent(utf8); } catch { /* use regular filename */ } }
    filename = filename.replace(/[\\/\u0000-\u001f\u007f]/g, "_");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    try {
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    return filename;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("Pembuatan dokumen melewati batas waktu. Periksa daftar dokumen sebelum mencoba kembali.");
    if (error instanceof TypeError)
      throw new Error("Gagal menghubungi server. Periksa koneksi lalu coba lagi.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
