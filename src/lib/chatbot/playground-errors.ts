const statuses: Record<string, number> = {
  SANDBOX_BUSY: 409, SANDBOX_RATE_LIMIT: 429, SANDBOX_CAPACITY: 503,
  AI_QUOTA_EXHAUSTED: 429, AI_RATE_LIMIT: 429, AI_UNAVAILABLE: 503,
  AI_AUTH_ERROR: 503, AI_MODEL_UNAVAILABLE: 503, AI_REQUEST_REJECTED: 503,
  SANDBOX_TIMEOUT: 504, UPSTREAM_TIMEOUT: 504, REQUEST_CANCELLED: 499,
  INVALID_REQUEST: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, TOO_LARGE: 413,
  NOT_CONFIGURED: 503, CHATBOT_BACKEND_UNREACHABLE: 503, CHATBOT_BACKEND_AUTH_ERROR: 503,
  CHATBOT_BACKEND_ENDPOINT_MISSING: 503, CHATBOT_BACKEND_INVALID_RESPONSE: 503,
  PROPERTY_LOOKUP_UNAVAILABLE: 503, INVALID_PROPERTY_CONTEXT: 503,
};

export function playgroundFailure(status: number, body: unknown, retryHeader: string | null = null) {
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const code = typeof data.error === "string" && Object.hasOwn(statuses, data.error) ? data.error
    : status === 429 ? "AI_RATE_LIMIT" : status === 504 ? "SANDBOX_TIMEOUT" : "SERVICE_UNAVAILABLE";
  const retry = retryHeader && /^\d+$/.test(retryHeader) ? Number(retryHeader) : data.retry_after_seconds;
  const retrySeconds = typeof retry === "number" && Number.isFinite(retry) && retry > 0 ? Math.min(86400, Math.ceil(retry)) : null;
  return { error: code, status: statuses[code] || 503, ...(retrySeconds ? { retry_after_seconds: retrySeconds } : {}) };
}

// A 401 from the bot service is a server-token problem, not an expired browser
// login. Preserve that distinction before returning an error to the dashboard.
export function playgroundBackendFailure(status: number, body: unknown, retryHeader: string | null = null) {
  if (status === 401 || status === 403) return playgroundFailure(503, { error: "CHATBOT_BACKEND_AUTH_ERROR" });
  if (status === 404 || status === 405) return playgroundFailure(503, { error: "CHATBOT_BACKEND_ENDPOINT_MISSING" });
  return playgroundFailure(status, body, retryHeader);
}

// Call only around the backend fetch: errors from login/database/request-body
// handling must never be incorrectly diagnosed as an unavailable bot process.
export function playgroundTransportFailure(error: unknown, cancelled = false) {
  const timeout = error instanceof Error && error.name === "TimeoutError";
  return playgroundFailure(cancelled ? 499 : timeout ? 504 : 503, {
    error: cancelled ? "REQUEST_CANCELLED" : timeout ? "SANDBOX_TIMEOUT" : "CHATBOT_BACKEND_UNREACHABLE",
  });
}

export function playgroundErrorMessage(code: string) {
  const messages: Record<string, string> = {
    AI_QUOTA_EXHAUSTED: "Kuota harian layanan AI sudah habis, termasuk model cadangan yang tersedia. Tunggu jadwal coba lagi atau minta pengelola memeriksa kuota API.",
    AI_RATE_LIMIT: "Layanan AI sedang membatasi permintaan. Pesan Anda disimpan; coba lagi setelah jeda berikut.",
    SANDBOX_RATE_LIMIT: "Batas pengujian sesi ini tercapai: 30 pesan dalam 5 menit. Pesan Anda disimpan sampai sesi dapat dilanjutkan.",
    SANDBOX_BUSY: "Masih ada pesan yang diproses untuk akun ini, mungkin dari tab lain. Selesaikan atau reset percakapan tersebut, lalu coba lagi.",
    SANDBOX_CAPACITY: "Playground sedang melayani banyak percakapan. Coba kembali sebentar lagi.",
    AI_UNAVAILABLE: "Layanan AI sedang mengalami gangguan. Pesan Anda tetap tersimpan untuk dicoba kembali.",
    AI_AUTH_ERROR: "Akses layanan AI ditolak. Minta pengelola memeriksa API key dan izin akun AI.",
    AI_MODEL_UNAVAILABLE: "Model AI yang dikonfigurasi tidak tersedia. Minta pengelola memperbarui model.",
    AI_REQUEST_REJECTED: "Konfigurasi permintaan AI ditolak. Minta pengelola memeriksa pengaturan model.",
    SANDBOX_TIMEOUT: "Jawaban melewati batas waktu. Pesan Anda disimpan; silakan coba lagi.",
    UPSTREAM_TIMEOUT: "Layanan AI atau database terlalu lama merespons. Silakan coba lagi.",
    REQUEST_CANCELLED: "Permintaan sebelumnya dibatalkan. Silakan kirim kembali jika masih diperlukan.",
    INVALID_REQUEST: "Pesan atau riwayat belum dapat diproses. Periksa isi pesan atau mulai percakapan baru.",
    TOO_LARGE: "Percakapan terlalu panjang. Mulai percakapan baru untuk melanjutkan pengujian.",
    UNAUTHENTICATED: "Sesi login berakhir. Silakan masuk kembali.",
    FORBIDDEN: "Akun Anda belum memiliki akses ke Playground.",
    NOT_CONFIGURED: "Koneksi ke layanan chatbot belum dikonfigurasi. Minta pengelola memeriksa pengaturan backend.",
    CHATBOT_BACKEND_UNREACHABLE: "Website tidak dapat menghubungi backend chatbot. Pastikan layanan backend tetap berjalan dan alamat koneksinya benar. Pairing WhatsApp tidak diperlukan untuk Playground.",
    CHATBOT_BACKEND_AUTH_ERROR: "Koneksi backend ditolak karena token akses tidak cocok. Minta pengelola menyamakan token website dan backend chatbot.",
    CHATBOT_BACKEND_ENDPOINT_MISSING: "Alamat backend belum menyediakan layanan Playground. Periksa alamat koneksi dan versi backend yang berjalan.",
    CHATBOT_BACKEND_INVALID_RESPONSE: "Respons backend belum sesuai format Playground. Pastikan website dan backend memakai pembaruan yang sama.",
    PROPERTY_LOOKUP_UNAVAILABLE: "Layanan data properti belum dapat diakses. Minta pengelola memeriksa koneksi database.",
    INVALID_PROPERTY_CONTEXT: "Format data properti belum kompatibel dengan backend bot. Jalankan ulang backend setelah pembaruan, lalu coba lagi.",
  };
  return messages[code] || "Layanan AI atau database belum dapat diakses. Pesan Anda disimpan untuk dicoba lagi.";
}
