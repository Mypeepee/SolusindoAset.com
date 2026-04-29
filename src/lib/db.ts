// lib/db.ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface PropertyRow {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  alamat_lengkap: string | null;
  harga: string;
  jenis_transaksi: string;
  kategori: string;
  gambar: string | null;
  luas_tanah: string | null;
  luas_bangunan: string | null;
  kamar_tidur: number | null;
  kamar_mandi: number | null;
  nama_kantor: string | null;
  kota_area: string | null;
  tanggal_lelang: string | null;
}

export interface PropertyDB {
  id_property: string;
  slug: string;
  judul: string;
  kota: string;
  alamat_lengkap: string;
  harga: number;
  jenis_transaksi: string;
  kategori: string;
  gambar: string;
  foto_list: string[];
  luas_tanah: number;
  luas_bangunan: number;
  kamar_tidur: number;
  kamar_mandi: number;
  agent_name: string;
  agent_photo: string;
  agent_office: string;
  tanggal_lelang?: string | null;
}

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

const PAGE_SIZE = 9;

export async function getAllProperties(
  page: number = 1
): Promise<{ properties: PropertyDB[]; pagination: PaginationData }> {
  const client = await pool.connect();
  try {
    const offset = (page - 1) * PAGE_SIZE;

    const countRes = await client.query<{ count: string }>(
      `SELECT COUNT(*)::bigint AS count FROM public.property WHERE status_tayang = 'TERSEDIA'`
    );
    const totalItems = Number(countRes.rows[0]?.count || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    const res = await client.query<PropertyRow>(
      `
      SELECT
        p.id_property,
        p.slug,
        p.judul,
        p.kota,
        COALESCE(p.alamat_lengkap, '') AS alamat_lengkap,
        p.harga::text,
        p.jenis_transaksi,
        p.kategori,
        p.gambar,
        p.luas_tanah::text,
        p.luas_bangunan::text,
        p.kamar_tidur,
        p.kamar_mandi,
        a.nama_kantor,
        a.kota_area,
        p.tanggal_lelang::text
      FROM public.property p
      LEFT JOIN public.agent a ON a.id_agent = p.id_agent
      WHERE p.status_tayang = 'TERSEDIA'
      ORDER BY p.tanggal_dibuat DESC
      LIMIT $1 OFFSET $2
      `,
      [PAGE_SIZE, offset]
    );

    const properties: PropertyDB[] = res.rows.map((row) => {
      const rawGambar = row.gambar || "";
      const foto_list =
        rawGambar.trim().length > 0
          ? rawGambar.split(",").map((s) => s.trim())
          : [];

      return {
        id_property: row.id_property,
        slug: row.slug,
        judul: row.judul,
        kota: row.kota,
        alamat_lengkap: row.alamat_lengkap || "",
        harga: Number(row.harga),
        jenis_transaksi: row.jenis_transaksi,
        kategori: row.kategori,
        gambar: foto_list[0] || row.gambar || "/images/hero/banner.jpg",
        foto_list,
        luas_tanah: row.luas_tanah ? Number(row.luas_tanah) : 0,
        luas_bangunan: row.luas_bangunan ? Number(row.luas_bangunan) : 0,
        kamar_tidur: row.kamar_tidur ?? 0,
        kamar_mandi: row.kamar_mandi ?? 0,

        // sementara pakai placeholder untuk nama agent
        agent_name: "Agent Premier",
        agent_photo: "/images/user/user-01.png",
        agent_office:
          row.nama_kantor && row.kota_area
            ? `${row.nama_kantor} • ${row.kota_area}`
            : row.nama_kantor || row.kota_area || "Premier Pusat",

        tanggal_lelang: row.tanggal_lelang,
      };
    });

    return {
      properties,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
      },
    };
  } finally {
    client.release();
  }
}
