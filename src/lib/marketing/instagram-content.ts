import { z } from "zod";

export const instagramId = z.string().regex(/^[1-9]\d{0,31}$/);
export const instagramCursor = z
  .string()
  .max(4000)
  .regex(/^[A-Za-z0-9_/=+.-]+$/)
  .optional();
export const instagramActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete-media"),
    mediaId: instagramId,
    requestId: z.string().uuid(),
    accountId: instagramId,
  }),
  z.object({
    action: z.literal("comments-enabled"),
    mediaId: instagramId,
    enabled: z.boolean(),
    requestId: z.string().uuid(),
    accountId: instagramId,
  }),
  z.object({
    action: z.literal("reply"),
    mediaId: instagramId,
    commentId: instagramId,
    message: z.string().trim().min(1).max(2200),
    requestId: z.string().uuid(),
    accountId: instagramId,
  }),
  z.object({
    action: z.literal("hide-comment"),
    mediaId: instagramId,
    commentId: instagramId,
    hidden: z.boolean(),
    requestId: z.string().uuid(),
    accountId: instagramId,
  }),
  z.object({
    action: z.literal("delete-comment"),
    mediaId: instagramId,
    commentId: instagramId,
    requestId: z.string().uuid(),
    accountId: instagramId,
  }),
]);
export type InstagramAction = z.infer<typeof instagramActionSchema>;
export type InstagramMedia = {
  id: string;
  caption: string;
  type: string;
  product: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  likes: number | null;
  comments: number | null;
  commentsEnabled: boolean | null;
};
export type InstagramComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string | null;
  hidden: boolean | null;
  likes: number | null;
};
export type InstagramPage<T> = { items: T[]; after: string | null };
export type InstagramCapabilities = {
  insights: boolean;
  comments: boolean;
  deleteMedia: boolean;
  verified: boolean;
  missing: string[];
};
export type InstagramLibrary = InstagramPage<InstagramMedia> & {
  account: {
    id: string;
    username: string;
    name: string;
    picture: string | null;
    followers: number | null;
    following: number | null;
    mediaCount: number | null;
  };
  capabilities: InstagramCapabilities;
  fetchedAt: string;
};
export type InstagramInsight = {
  name: string;
  value: number | null;
  issue: string | null;
};
export type InstagramDetail = {
  media: InstagramMedia;
  children: InstagramMedia[];
  insights: InstagramInsight[];
  capabilities: InstagramCapabilities;
  fetchedAt: string;
};
export const instagramMetricLabels: Record<string, string> = {
  views: "Tayangan",
  reach: "Akun dijangkau",
  likes: "Suka",
  comments: "Komentar",
  saved: "Disimpan",
  shares: "Dibagikan",
  total_interactions: "Total interaksi",
  follows: "Pengikut baru",
  profile_visits: "Kunjungan profil",
  replies: "Balasan Story",
  navigation: "Navigasi Story",
  link_clicks: "Klik tautan",
  ig_reels_avg_watch_time: "Rata-rata waktu tonton",
  ig_reels_video_view_total_time: "Total waktu tonton",
  reels_skip_rate: "Rasio dilewati",
};
export const instagramContentErrors: Record<string, string> = {
  INSTAGRAM_REQUEST_ID_UNAVAILABLE:
    "Permintaan belum dikirim. Buka situs melalui HTTPS atau gunakan peramban terbaru, lalu coba hapus kembali.",
  UNAUTHENTICATED: "Sesi berakhir. Masuk kembali untuk mengelola Instagram.",
  FORBIDDEN: "Pengelolaan Instagram hanya tersedia untuk OWNER aktif.",
  TOKEN_EXPIRED:
    "Koneksi Instagram kedaluwarsa. Hubungkan kembali melalui Pengaturan.",
  OAUTH_RECONNECT_REQUIRED: "Hubungkan ulang Instagram melalui Pengaturan.",
  INSTAGRAM_NOT_CONNECTED:
    "Hubungkan Instagram perusahaan melalui Pengaturan terlebih dahulu.",
  INSTAGRAM_PERMISSION_REQUIRED:
    "Izin untuk tindakan ini belum diberikan. Hubungkan ulang Instagram dan setujui izin yang diperlukan.",
  INSTAGRAM_DELETE_UNSUPPORTED:
    "Hapus konten memerlukan Facebook Login dan izin instagram_manage_contents. Anda juga dapat menghapusnya langsung di Instagram.",
  INSTAGRAM_ACCOUNT_CHANGED:
    "Akun Instagram telah berubah. Perbarui daftar konten sebelum melanjutkan.",
  INSTAGRAM_MEDIA_UNAVAILABLE:
    "Konten tidak tersedia atau bukan milik akun Instagram yang terhubung. Perbarui daftar konten.",
  INSTAGRAM_COMMENT_UNAVAILABLE:
    "Komentar tidak tersedia atau bukan bagian dari konten ini. Perbarui komentar.",
  INSTAGRAM_ACTION_PENDING:
    "Tindakan ini masih diproses. Periksa kembali beberapa saat lagi.",
  INSTAGRAM_ACTION_UNCERTAIN:
    "Hasil tindakan belum dapat dipastikan. Periksa konten atau komentar di Instagram sebelum membuat tindakan baru; permintaan ini tidak dikirim ulang.",
  INSTAGRAM_ACTION_CONFLICT:
    "Permintaan sudah dipakai untuk tindakan lain. Perbarui halaman.",
  INSTAGRAM_ACTION_FAILED:
    "Tindakan sebelumnya ditolak Instagram. Perbarui data sebelum mencoba tindakan baru.",
  INSTAGRAM_ACTION_BUSY:
    "Tindakan lain untuk konten ini sedang diproses. Tunggu lalu perbarui data.",
  RATE_LIMIT:
    "Batas permintaan Instagram tercapai. Tunggu beberapa saat sebelum memperbarui.",
  PROVIDER_ERROR:
    "Instagram belum dapat memproses permintaan. Coba kembali beberapa saat lagi.",
  DELIVERY_UNCERTAIN:
    "Hasil belum dapat dipastikan. Periksa Instagram sebelum mencoba lagi.",
  INVALID_REQUEST: "Permintaan tidak valid. Periksa isian lalu coba kembali.",
  SCHEMA_NOT_READY:
    "Penyimpanan riwayat tindakan belum siap. Jalankan pembaruan database Pemasaran pada server.",
};
export function instagramErrorLabel(code: string) {
  return (
    instagramContentErrors[code] ||
    "Instagram belum dapat dimuat. Periksa koneksi lalu coba kembali."
  );
}
export function instagramMediaLabel(
  media: Pick<InstagramMedia, "type" | "product">,
) {
  return media.product === "STORY"
    ? "Story"
    : media.product === "REELS"
      ? "Reel"
      : media.type === "CAROUSEL_ALBUM"
        ? "Carousel"
        : media.type === "VIDEO"
          ? "Video"
          : "Foto";
}
