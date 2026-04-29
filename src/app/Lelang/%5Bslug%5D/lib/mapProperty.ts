// app/Lelang/[slug]/lib/mapProperty.ts
import type { PropertyData } from "../DetailClient"; // sesuaikan path export tipe PropertyData-mu

// Jika PropertyData didefinisikan di file lain, update path import di atas.

type PrismaProperty = any; // kalau mau lebih ketat, import tipe Prisma.Property

type PrismaAgent = {
  nama_kantor: string | null;
  rating: number | null;
  jumlah_closing: number | null;
  nomor_whatsapp: string | null;
  kota_area: string | null;
  jabatan: string | null;
  pengguna: {
    nama_lengkap: string | null;
    foto_profil_url: string | null;
    nomor_telepon: string | null;
    email: string | null;
  } | null;
} | null;

export function mapPropertyToDetailData(
  p: PrismaProperty,
  agent: PrismaAgent
): PropertyData {
  // pecah gambar utama, pakai yang pertama sebagai gambar_utama
  const rawGambar: string = p.gambar || "";
  const fotoArray =
    rawGambar.trim().length > 0
      ? rawGambar
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];
  const gambarUtama = fotoArray[0] || "/images/hero/banner.jpg";

  return {
    id_property: p.id_property,
    kode_properti: p.kode_properti,
    judul: p.judul,
    title: p.judul,

    kota: p.kota,
    alamat_lengkap: p.alamat_lengkap,
    address: p.alamat_lengkap,
    area_lokasi: p.area_lokasi,
    kelurahan: p.kelurahan,
    kecamatan: p.kecamatan,
    provinsi: p.provinsi,
    latitude: p.latitude,
    longitude: p.longitude,

    harga: Number(p.harga),
    harga_promo: p.harga_promo,
    jenis_transaksi: p.jenis_transaksi,
    kategori: p.kategori,
    status_tayang: p.status_tayang,
    is_hot_deal: p.is_hot_deal,
    dilihat: p.dilihat ?? 0,
    tanggal_lelang: p.tanggal_lelang,

    uang_jaminan: p.uang_jaminan,
    nilai_limit_lelang: p.nilai_limit_lelang,

    luas_tanah: p.luas_tanah,
    luas_bangunan: p.luas_bangunan,
    kamar_tidur: p.kamar_tidur,
    kamar_mandi: p.kamar_mandi,
    jumlah_lantai: p.jumlah_lantai,
    daya_listrik: p.daya_listrik,
    sumber_air: p.sumber_air,
    hadap_bangunan: p.hadap_bangunan,
    kondisi_interior: p.kondisi_interior,
    legalitas: p.legalitas,

    deskripsi: p.deskripsi,

    gambar_utama: gambarUtama,

    agent: agent
      ? {
          nama: agent.pengguna?.nama_lengkap || "Agent Premier",
          telepon: agent.pengguna?.nomor_telepon || "",
          whatsapp: agent.nomor_whatsapp || "",
          email: agent.pengguna?.email || "",
          kantor: agent.nama_kantor || "",
          foto_url: agent.pengguna?.foto_profil_url || "",
          rating: agent.rating ?? 0,
          jumlah_closing: agent.jumlah_closing ?? 0,
          kota_area: agent.kota_area || "",
          jabatan: agent.jabatan || "",
        }
      : {
          nama: "Agent Premier",
          telepon: "",
          whatsapp: "",
          email: "",
          kantor: "",
          foto_url: "",
          rating: 0,
          jumlah_closing: 0,
          kota_area: "",
          jabatan: "",
        },

    // Owner bisa kamu refine kalau punya tabel owner terpisah,
    // untuk sekarang isi basic saja agar type tidak error.
    owner: {
      name: p.owner_name || "",
      avatar: p.owner_avatar || "",
      phone: p.owner_phone || "",
      office: p.owner_office || "",
      rating: 0,
      closing: 0,
      area: "",
      join: "",
    },

    priceRates: {
      monthly: 0,
      daily: 0,
    },
  };
}
