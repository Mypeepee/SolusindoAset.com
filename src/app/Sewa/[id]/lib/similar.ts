/**
 * Rekomendasi "Sewa Serupa" untuk halaman detail sewa.
 *
 * Ini berlaku untuk seluruh kategori SEWA, bukan hanya kos. "Serupa" bukan
 * berarti sekadar sama-sama disewakan: sebuah rumah tidak boleh pernah
 * merekomendasikan pabrik atau gudang. Kategori dan periode harga menjadi
 * pintu masuk yang ketat; lokasi dan spesifikasi kemudian menentukan urutan.
 * Untuk kos, patokan aktivitas dan gender tetap diberi bobot tambahan karena
 * keduanya memang menentukan kecocokan hunian. Karena itu:
 *
 *   • kecamatan/kelurahan bernilai lebih besar daripada kota,
 *   • kategori yang sama adalah filter wajib, bukan sekadar bonus skor,
 *   • harga dibandingkan hanya pada periode sewa yang sama,
 *   • bila hasil benar-benar tidak relevan, blok tidak dipaksakan tampil.
 */

import prisma from "@/lib/prisma";
import {
  DURASI_META,
  DURASI_URUT,
  isDurasiKey,
  type AksesTerdekat,
  type DurasiKey,
} from "@/lib/kosDetail";
import type { SewaSimilarItem } from "../types";

const MAX_HASIL = 8;
/** Kota yang sama + satu faktor utama (harga/spesifikasi) sudah melampaui ini. */
const RELEVANSI_MIN = 46;

function normLoc(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya|kec\.?|kecamatan)\s+/, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function kotaTerm(s?: string | null): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/^(kota|kab\.?|kabupaten|kotamadya)\s+/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

const angka = (v: unknown): number => {
  const hasil = Number(v ?? 0);
  return Number.isFinite(hasil) ? hasil : 0;
};

/**
 * Kedekatan dua angka positif. Tidak memberi poin saat salah satu data tidak
 * diisi: data yang belum lengkap tidak boleh dianggap "sama" secara palsu.
 */
function skorAngkaMirip(
  a: unknown,
  b: unknown,
  poinMaks: number,
  toleransi: number,
): number {
  const x = angka(a);
  const y = angka(b);
  if (x <= 0 || y <= 0) return 0;

  const selisih = Math.abs(x - y) / Math.max(x, y);
  if (selisih > toleransi) return 0;
  return poinMaks * (1 - selisih / toleransi);
}

function skorSama(a: unknown, b: unknown, poin: number): number {
  if (a == null || b == null || a === "" || b === "") return 0;
  return String(a).trim().toUpperCase() === String(b).trim().toUpperCase()
    ? poin
    : 0;
}

function daftarFasilitas(v: unknown): Set<string> {
  if (typeof v !== "string") return new Set();
  return new Set(
    v
      .split(/[,|]/)
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean),
  );
}

function skorFasilitas(a: unknown, b: unknown, poinMaks: number): number {
  const kiri = daftarFasilitas(a);
  const kanan = daftarFasilitas(b);
  if (!kiri.size || !kanan.size) return 0;
  const sama = [...kiri].filter((f) => kanan.has(f)).length;
  return poinMaks * (sama / Math.max(kiri.size, kanan.size));
}

/**
 * Seluruh foto listing, bukan hanya yang pertama — kartu bersama punya slider,
 * jadi mengirim satu foto saja akan mematikan sliderrnya khusus di blok ini dan
 * kartunya jadi terasa berbeda dari yang di halaman daftar.
 *
 * Aturan penerjemahannya harus sama dengan `normalizeListingImages` di
 * /Sewa/page.tsx: ID Google Drive telanjang diubah jadi URL thumbnail, URL
 * yang sudah utuh dibiarkan.
 */
function fotoListing(gambar: string | null): string[] {
  return (gambar ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")
        ? s
        : `https://drive.google.com/thumbnail?id=${s}`,
    );
}

/** Sama dengan `normalizeAgentPhoto` di /Sewa/page.tsx. */
function fotoAgent(fileId: string | null | undefined): string {
  const trimmed = (fileId ?? "").trim();
  if (!trimmed) return "/images/default-profile.png";
  return trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
    ? trimmed
    : `https://drive.google.com/thumbnail?id=${trimmed}`;
}

const asAkses = (v: unknown): AksesTerdekat[] =>
  Array.isArray(v) ? (v as AksesTerdekat[]).filter((a) => a?.nama) : [];

/** Durasi utama; bila data lama belum memilikinya, ambil durasi berharga pertama. */
function durasiHarga(detail: any): DurasiKey | null {
  const durasiMentah: unknown = detail?.durasi_sewa;
  if (isDurasiKey(durasiMentah)) return durasiMentah;
  return (
    DURASI_URUT.find(
      (durasi) => angka(detail?.[DURASI_META[durasi].field]) > 0,
    ) ?? null
  );
}

/**
 * Harga pada periode yang sama dengan listing yang sedang dibuka. Bila periode
 * acuannya ada tetapi kandidat tidak menawarkannya, harga bernilai nol —
 * kandidat tersebut disisihkan, bukan dibandingkan secara keliru dengan
 * harga periode lain.
 */
function hargaPadaDurasi(
  detail: any,
  durasi: DurasiKey | null,
  hargaCadangan: unknown = 0,
): { harga: number; durasi: DurasiKey | null } {
  if (durasi) {
    const v = Number(detail?.[DURASI_META[durasi].field] ?? 0);
    return { harga: v > 0 ? v : 0, durasi };
  }

  const durasiUtama = durasiHarga(detail);
  if (durasiUtama) {
    const v = Number(detail?.[DURASI_META[durasiUtama].field] ?? 0);
    if (v > 0) return { harga: v, durasi: durasiUtama };
  }

  return { harga: angka(hargaCadangan), durasi: null };
}

export async function getSimilarSewa(current: any): Promise<SewaSimilarItem[]> {
  try {
    const curId = BigInt(String(current.id_property));
    const durasiAcuan = durasiHarga(current.sewaDetail);

    const baseWhere = {
      id_property: { not: curId },
      jenis_transaksi: "SEWA" as const,
      status_tayang: "TERSEDIA" as const,
      // Filter keras: "Sewa Serupa" rumah hanya berisi rumah, begitu pula
      // apartemen, ruko, gudang, pabrik, tanah, hotel/villa, dan kos.
      kategori: current.kategori,
    };

    // Agent ikut diambil karena kartu bersama menampilkan footer agent —
    // tanpa ini kartunya tampil dengan nama & foto kosong, dan justru itu yang
    // membuatnya terlihat beda dari kartu di halaman daftar.
    const include = {
      agent: {
        select: {
          nama_kantor: true,
          foto_profil_url: true,
          pengguna: { select: { nama_lengkap: true } },
        },
      },
      sewaDetail: true,
      _count: { select: { kamarTipe: true } },
    } as const;

    const term = kotaTerm(current.kota);
    const pool = term
      ? await prisma.listing.findMany({
          where: { ...baseWhere, kota: { contains: term, mode: "insensitive" } },
          include,
          take: 80,
          orderBy: [{ is_hot_deal: "desc" }, { tanggal_dibuat: "desc" }],
        })
      : [];

    // Jangan melebar sampai provinsi: "satu provinsi" dapat berarti ratusan
    // kilometer. Bila kota tidak punya alternatif yang benar-benar dekat,
    // lebih jujur tidak menampilkan rekomendasi daripada mengarang relevansi.
    const acuan = hargaPadaDurasi(
      current.sewaDetail,
      durasiAcuan,
      current.harga,
    );
    const curKec = normLoc(current.kecamatan);
    const curKel = normLoc(current.kelurahan);
    const curKota = normLoc(current.kota);
    const isKos = String(current.kategori).toUpperCase() === "KOS";
    const isApartemen = String(current.kategori).toUpperCase() === "APARTEMEN";
    const curGender = current.sewaDetail?.kos_gender ?? null;
    const curAkses = new Set(
      asAkses(current.akses_terdekat).map((a) => normLoc(a.nama)),
    );

    const dinilai = pool.flatMap((c) => {
      // Kos putra/putri adalah batas kebutuhan, bukan preferensi ringan.
      // Kos campur masih boleh masuk untuk keduanya.
      const cGender = c.sewaDetail?.kos_gender ?? null;
      const genderBerbeda =
        isKos &&
        curGender &&
        cGender &&
        curGender !== "CAMPUR" &&
        cGender !== "CAMPUR" &&
        curGender !== cGender;
      if (genderBerbeda) return [];

      // Unit kos/apartemen yang diketahui penuh tidak boleh disarankan. Nilai
      // null sengaja dibiarkan: berarti pemilik belum memakai inventaris, bukan
      // berarti unitnya pasti penuh.
      if (
        (isKos || isApartemen) &&
        c.sewaDetail?.kamar_tersedia != null &&
        c.sewaDetail.kamar_tersedia <= 0
      ) {
        return [];
      }

      const cHarga = hargaPadaDurasi(c.sewaDetail, durasiAcuan, c.harga);
      // Jangan membandingkan Rp5 juta/bulan dengan Rp50 juta/tahun. Saat
      // halaman asal memiliki periode yang jelas, kandidat wajib menawarkan
      // periode yang sama.
      if (durasiAcuan && cHarga.harga <= 0) return [];

      let skor = 0;

      const cKec = normLoc(c.kecamatan);
      const cKel = normLoc(c.kelurahan);
      if (curKel && cKel && cKel === curKel) skor += 50;
      else if (curKec && cKec && cKec === curKec) skor += 40;
      else if (curKota && normLoc(c.kota) === curKota) skor += 25;

      // Patokan aktivitas dan gender adalah pembeda khusus kos. Untuk rumah,
      // apartemen, ruko, dan sewa lain data ini tidak bermakna sehingga tidak
      // boleh membuat rekomendasinya bias atau gagal tampil.
      if (isKos) {
        const samaAkses = asAkses(c.akses_terdekat).filter((a) =>
          curAkses.has(normLoc(a.nama)),
        ).length;
        skor += Math.min(15, samaAkses * 8);
      }

      if (acuan.harga > 0 && cHarga.harga > 0) {
        const beda = Math.abs(cHarga.harga - acuan.harga) / acuan.harga;
        skor += Math.max(0, 28 * (1 - beda / 0.45));
      }

      if (isKos && curGender && cGender) {
        if (cGender === curGender) skor += 10;
        else if (cGender === "CAMPUR" || curGender === "CAMPUR") skor += 4;
      }

      const kategori = String(current.kategori).toUpperCase();
      if (kategori === "KOS") {
        skor += skorSama(
          current.sewaDetail?.kamar_mandi_tipe,
          c.sewaDetail?.kamar_mandi_tipe,
          8,
        );
        skor += skorAngkaMirip(
          current.sewaDetail?.luas_kamar,
          c.sewaDetail?.luas_kamar,
          10,
          0.35,
        );
        skor += skorAngkaMirip(
          current.sewaDetail?.kapasitas_penghuni,
          c.sewaDetail?.kapasitas_penghuni,
          5,
          0.5,
        );
        skor += skorFasilitas(
          current.sewaDetail?.fasilitas_kamar,
          c.sewaDetail?.fasilitas_kamar,
          7,
        );
      } else if (kategori === "APARTEMEN") {
        skor += skorSama(current.sewaDetail?.tipe_unit, c.sewaDetail?.tipe_unit, 16);
        skor += skorSama(current.sewaDetail?.nama_gedung, c.sewaDetail?.nama_gedung, 8);
        skor += skorAngkaMirip(current.luas_bangunan, c.luas_bangunan, 10, 0.3);
        skor += skorAngkaMirip(
          current.sewaDetail?.kapasitas_penghuni,
          c.sewaDetail?.kapasitas_penghuni,
          5,
          0.5,
        );
        skor += skorSama(current.kondisi_interior, c.kondisi_interior, 5);
      } else if (kategori === "RUMAH" || kategori === "HOTEL_DAN_VILLA") {
        skor += skorAngkaMirip(current.kamar_tidur, c.kamar_tidur, 13, 0.5);
        skor += skorAngkaMirip(current.kamar_mandi, c.kamar_mandi, 7, 0.5);
        skor += skorAngkaMirip(current.luas_bangunan, c.luas_bangunan, 10, 0.4);
        skor += skorAngkaMirip(current.luas_tanah, c.luas_tanah, 7, 0.4);
        skor += skorSama(current.kondisi_interior, c.kondisi_interior, 4);
      } else if (kategori === "RUKO" || kategori === "TOKO") {
        skor += skorAngkaMirip(current.luas_bangunan, c.luas_bangunan, 14, 0.35);
        skor += skorAngkaMirip(current.luas_tanah, c.luas_tanah, 8, 0.4);
        skor += skorAngkaMirip(current.jumlah_lantai, c.jumlah_lantai, 6, 0.5);
        skor += skorSama(current.kondisi_interior, c.kondisi_interior, 4);
      } else if (kategori === "GUDANG" || kategori === "PABRIK") {
        skor += skorAngkaMirip(current.luas_bangunan, c.luas_bangunan, 16, 0.35);
        skor += skorAngkaMirip(current.luas_tanah, c.luas_tanah, 10, 0.4);
        skor += skorAngkaMirip(current.daya_listrik, c.daya_listrik, 7, 0.5);
        skor += skorAngkaMirip(current.jumlah_lantai, c.jumlah_lantai, 3, 0.5);
      } else if (kategori === "TANAH") {
        skor += skorAngkaMirip(current.luas_tanah, c.luas_tanah, 22, 0.35);
      }

      if (c.is_hot_deal) skor += 4;

      return [{ c, skor, harga: cHarga }];
    });

    return dinilai
      .filter((s) => s.skor >= RELEVANSI_MIN)
      .sort((a, b) => b.skor - a.skor)
      .slice(0, MAX_HASIL)
      // Bentuk hasilnya PropertyDB — bentuk yang dipakai kartu bersama, dan
      // disusun sama persis dengan /Sewa/page.tsx. Kalau di sini ada field yang
      // dilewatkan, kartunya akan kehilangan satu bagian (slider, Hot Deal,
      // sisa kamar, footer agent) dan tidak lagi "sangat persis".
      .map(({ c, harga }): SewaSimilarItem => {
        const fotoList = fotoListing(c.gambar);

        return {
          id_property: String(c.id_property),
          slug: c.slug,
          judul: c.judul,
          kota: c.kota,
          kecamatan: c.kecamatan,
          kelurahan: c.kelurahan,
          // Harga sengaja diambil pada DURASI YANG SAMA dengan listing yang
          // sedang dibuka (lihat hargaPadaDurasi), bukan `c.harga` mentah —
          // membandingkan "per bulan" dengan "per tahun" tidak ada gunanya.
          harga: harga.harga || Number(c.harga ?? 0),
          harga_promo: c.harga_promo != null ? Number(c.harga_promo) : null,
          jenis_transaksi: c.jenis_transaksi,
          kategori: c.kategori,
          status_tayang: c.status_tayang,
          gambar: fotoList[0] || "/images/hero/banner.jpg",
          foto_list: fotoList,
          luas_tanah: c.luas_tanah ? Number(c.luas_tanah) : 0,
          luas_bangunan: c.luas_bangunan ? Number(c.luas_bangunan) : 0,
          kamar_tidur: c.kamar_tidur ?? 0,
          kamar_mandi: c.kamar_mandi ?? 0,
          // Durasi yang dipakai menghitung `harga` di atas, supaya akhiran
          // "/bulan" di kartu cocok dengan angkanya.
          durasi_sewa: harga.durasi,
          kamar_mandi_tipe: c.sewaDetail?.kamar_mandi_tipe ?? null,
          kos_gender: c.sewaDetail?.kos_gender ?? null,
          kamar_tersedia: c.sewaDetail?.kamar_tersedia ?? null,
          tipe_unit: c.sewaDetail?.tipe_unit ?? null,
          lantai_unit: c.sewaDetail?.lantai_unit ?? null,
          kapasitas_penghuni: c.sewaDetail?.kapasitas_penghuni ?? null,
          kondisi_interior: c.kondisi_interior ?? null,
          jumlah_tipe_kamar: c._count?.kamarTipe ?? 0,
          fasilitas_kamar: c.sewaDetail?.fasilitas_kamar ?? null,
          fasilitas_bersama: c.sewaDetail?.fasilitas_bersama ?? null,
          akses_terdekat: asAkses(c.akses_terdekat),
          agent_name: c.agent?.pengguna?.nama_lengkap || "Agent Premier",
          agent_photo: fotoAgent(c.agent?.foto_profil_url),
          agent_office: c.agent?.nama_kantor || "Solusindo Aset",
          is_hot_deal: !!c.is_hot_deal,
        };
      });
  } catch (err) {
    console.error("getSimilarSewa error:", err);
    return [];
  }
}
