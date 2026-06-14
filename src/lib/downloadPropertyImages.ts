// src/lib/downloadPropertyImages.ts
// Unduh/bagikan foto-foto properti via proxy /api/download-images.
// Mobile: native share sheet. Desktop: download sequential.

export async function downloadPropertyImages(
  fotoList: string[],
  onStateChange?: (loading: boolean) => void,
): Promise<void> {
  if (!fotoList.length) {
    alert("Belum ada foto untuk diunduh.");
    return;
  }

  onStateChange?.(true);
  try {
    // Fetch all images via server proxy (handles CORS)
    const files = await Promise.all(
      fotoList.map(async (url, i) => {
        const res = await fetch(`/api/download-images?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error(`Gagal mengambil foto ${i + 1}`);
        const blob = await res.blob();
        const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        return new File([blob], `foto_${String(i + 1).padStart(3, "0")}.${ext}`, { type: blob.type || "image/jpeg" });
      })
    );

    // Mobile (iOS/Android): Web Share API → native share sheet → "Simpan Gambar" → masuk Galeri
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && typeof navigator.share === "function" && navigator.canShare?.({ files })) {
      await navigator.share({ files, title: "Foto Properti" });
      return;
    }

    // Desktop: download satu per satu
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      alert("Gagal mengunduh gambar. Silakan coba lagi.");
    }
  } finally {
    onStateChange?.(false);
  }
}
