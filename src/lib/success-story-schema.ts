import { z } from "zod";
import { MAX_STORY_IMAGES, isTikTokUrl } from "./success-stories";

export const successStorySchema = z.object({
  id: z.string().uuid("Identitas proyek tidak valid. Muat ulang formulir."),
  title: z
    .string()
    .trim()
    .min(3, "Isi nama proyek, minimal 3 karakter.")
    .max(120, "Nama proyek maksimal 120 karakter."),
  location: z
    .string()
    .trim()
    .min(3, "Isi kota dan provinsi proyek.")
    .max(120, "Lokasi maksimal 120 karakter."),
  type: z
    .string()
    .trim()
    .min(2, "Isi kategori proyek.")
    .max(60, "Kategori maksimal 60 karakter."),
  desc: z
    .string()
    .trim()
    .min(20, "Ceritakan hasil proyek, minimal 20 karakter.")
    .max(1000, "Cerita maksimal 1.000 karakter."),
  marketPrice: z
    .number()
    .int()
    .positive("Isi harga pasaran yang valid.")
    .max(Number.MAX_SAFE_INTEGER, "Harga terlalu besar."),
  dealPrice: z
    .number()
    .int()
    .positive("Isi harga deal yang valid.")
    .max(Number.MAX_SAFE_INTEGER, "Harga terlalu besar."),
  images: z
    .array(
      z
        .string()
        .regex(
          /^\/uploads\/success-stories\/[A-Za-z0-9_-]+\/[a-f0-9-]+\.webp$/,
          "Unggah foto melalui formulir ini.",
        ),
    )
    .min(1, "Tambahkan minimal satu foto proyek.")
    .max(MAX_STORY_IMAGES, "Maksimal 6 foto per proyek."),
  tiktokUrl: z
    .string()
    .trim()
    .max(500, "Tautan terlalu panjang.")
    .refine(isTikTokUrl, "Gunakan tautan https dari TikTok.")
    .optional(),
});
