/** Public, allowlisted OAuth outcomes. Never include provider text or credentials. */
export const instagramOAuthMessages = {
  OAUTH_SESSION_REQUIRED:
    "Sesi web belum aktif. Masuk sebagai OWNER melalui alamat HTTPS yang sama, lalu hubungkan Instagram kembali.",
  OAUTH_FORBIDDEN: "Koneksi Instagram hanya dapat dilakukan oleh OWNER aktif.",
  OAUTH_STATE_INVALID:
    "Sesi login Instagram tidak cocok atau sudah berakhir. Mulai lagi melalui tombol Hubungkan Instagram di web ini.",
  OAUTH_ACCESS_DENIED:
    "Izin Instagram belum disetujui. Hubungkan kembali dan setujui izin akun perusahaan.",
  OAUTH_PROVIDER_REJECTED:
    "Meta menolak proses login. Periksa konfigurasi login dan akses akun penguji pada aplikasi Meta.",
  OAUTH_CODE_MISSING:
    "Instagram belum mengirim hasil login yang valid. Mulai kembali melalui tombol Hubungkan Instagram.",
  OAUTH_TOKEN_REJECTED:
    "Meta menolak pertukaran hasil login. Periksa Meta App ID/App Secret dari App settings → Basic dan alamat callback login, lalu coba kembali.",
  OAUTH_PERMISSIONS_MISSING:
    "Izin belum lengkap. Periksa izin membaca akun, menerbitkan konten, dan analitik pada konfigurasi login Meta, lalu hubungkan kembali.",
  OAUTH_BUSINESS_REQUIRED:
    "Portofolio bisnis belum terbaca. Hubungkan kembali melalui Unified Login dan pilih portofolio yang memiliki akun Instagram perusahaan.",
  OAUTH_ACCOUNT_NOT_SHARED:
    "Akun Instagram belum dapat dibaca dari Meta setelah persetujuan. Koneksi belum disimpan. Hubungkan kembali; jika tetap gagal, pembacaan izin akun perlu diperiksa.",
  OAUTH_ACCOUNT_MISMATCH:
    "Akun Instagram yang dibagikan belum sesuai dengan akun perusahaan yang ditetapkan di server. Periksa pilihan akun atau penetapan akun perusahaan.",
  OAUTH_ACCOUNT_PROFILE_UNAVAILABLE:
    "Persetujuan Meta berhasil. Akses profil Instagram melalui API belum tersedia, sehingga koneksi dashboard belum selesai.",
  OAUTH_ACCOUNT_PUBLISH_UNAVAILABLE:
    "Profil Instagram sudah ditemukan, tetapi akses publikasi untuk akun ini belum dapat diverifikasi dari Meta. Koneksi belum disimpan.",
  OAUTH_MULTIPLE_ACCOUNTS:
    "Lebih dari satu akun Instagram dibagikan. Hubungkan kembali dengan memilih hanya akun perusahaan, atau tentukan INSTAGRAM_ACCOUNT_ID di server.",
  OAUTH_RECONNECT_REQUIRED:
    "Hubungkan ulang akun perusahaan melalui metode login yang dikonfigurasi di website. Credential lama atau dari metode berbeda perlu diperbarui.",
  PROFESSIONAL_ACCOUNT_REQUIRED:
    "Gunakan akun Instagram profesional Business atau Creator.",
  RATE_LIMIT:
    "Instagram membatasi permintaan sementara. Tunggu beberapa saat lalu hubungkan kembali.",
  PROVIDER_ERROR:
    "Data akun belum dapat dibaca dari Instagram. Periksa izin aplikasi, lalu coba kembali.",
  ENCRYPTION_NOT_CONFIGURED:
    "Kunci enkripsi server belum siap. Lengkapi konfigurasi sebelum menghubungkan akun.",
  INSTAGRAM_CONNECTION_FAILED:
    "Instagram belum terhubung. Coba kembali melalui tombol Hubungkan Instagram.",
};
export type InstagramOAuthIssue = keyof typeof instagramOAuthMessages;
export function instagramOAuthIssue(value: unknown): InstagramOAuthIssue {
  return typeof value === "string" &&
    Object.hasOwn(instagramOAuthMessages, value)
    ? (value as InstagramOAuthIssue)
    : "INSTAGRAM_CONNECTION_FAILED";
}
export function instagramConnectionHref(
  publicOrigin: string | null,
  currentOrigin: string,
) {
  return publicOrigin && currentOrigin !== publicOrigin
    ? publicOrigin + "/dashboard/pemasaran?tab=pengaturan"
    : "/api/dashboard/pemasaran/instagram/connect";
}
