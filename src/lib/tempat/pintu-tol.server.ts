import "server-only";
import { Prisma } from "@prisma/client";
import prisma from "../prisma";
import { pindaiPintuTol } from "../nearbyPlaces.server";
import { bacaTempatJson } from "../nearbyPlaces";
import { bacaLandmarkJson, petakanLandmark } from "./landmark";
import { gabungPintuTol } from "./pintu-tol";
import { serapKamusDariPindaian } from "./serap";

/** Mengisi kategori baru pada cache yang sudah mempunyai titik berkualitas.
 * Satu permintaan peta melayani satu batch; tidak melakukan geocoding ulang. */
export async function lengkapiPintuTol(limit: number, offset: number) {
  const rows = await prisma.$queryRaw<Array<{
    id_property: bigint; latitude: Prisma.Decimal; longitude: Prisma.Decimal;
    sumber_titik: string | null; presisi_titik: string | null;
    kota: string; provinsi: string | null;
  }>>`
    SELECT s.id_property, s.latitude, s.longitude, s.sumber_titik,
           s.presisi_titik, l.kota, l.provinsi
    FROM listing_sekitar s JOIN listing l ON l.id_property = s.id_property
    WHERE s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      AND s.latitude BETWEEN -90 AND 90 AND s.longitude BETWEEN -180 AND 180
      AND NOT (s.latitude = 0 AND s.longitude = 0)
      AND (s.presisi_titik IN ('TITIK','ALAMAT','KELURAHAN','KECAMATAN')
           OR (s.presisi_titik IS NULL AND s.sumber_titik = 'LISTING'))
    ORDER BY s.id_property OFFSET ${offset} LIMIT ${Math.max(1, Math.min(Math.floor(limit), 10))}
  `;
  if (!rows.length) return { diproses: 0, gerbang: 0, relasi: 0 };
  const elements = await pindaiPintuTol(rows.map((row) => ({ lat: Number(row.latitude), lng: Number(row.longitude) })));
  const names = new Set<string>();
  let diproses = 0;
  for (const row of rows) {
    const lat = Number(row.latitude), lng = Number(row.longitude);
    const gerbang = petakanLandmark(elements, lat, lng).filter((place) => place.kelas === "PINTU_TOL");
    gerbang.forEach((place) => names.add(place.id));
    // Baca ulang setelah respons peta agar fasilitas baru dari pemindaian lain
    // tidak tertimpa oleh snapshot sebelum permintaan jaringan.
    const latest = await prisma.listingSekitar.findUnique({ where: { id_property: row.id_property } });
    if (!latest) continue;
    if (latest.latitude === null || latest.longitude === null ||
        Number(latest.latitude) !== lat || Number(latest.longitude) !== lng ||
        latest.presisi_titik === "KOTA" || (!latest.presisi_titik && latest.sumber_titik !== "LISTING")) continue;
    const merged = gabungPintuTol(bacaTempatJson(latest.tempat), bacaLandmarkJson(latest.landmark), gerbang, latest.radius_meter);
    const saved = await prisma.listingSekitar.updateMany({ where: {
      id_property: row.id_property, latitude: latest.latitude, longitude: latest.longitude,
      dipindai_pada: latest.dipindai_pada,
    }, data: {
      tempat: merged.tempat as unknown as Prisma.InputJsonValue,
      landmark: merged.landmark as unknown as Prisma.InputJsonValue,
      jumlah: merged.tempat.length,
    } });
    if (!saved.count) continue;
    diproses++;
    // Cache titik dapat dipakai aset baru; hitung jarak dari titik cache itu
    // sendiri sebelum menyimpan agar perbedaan pin tidak mengubah jaraknya.
    const kunci = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const point = await prisma.sekitarTitik.findUnique({ where: { kunci } });
    if (point) {
      const nearby = petakanLandmark(elements, Number(point.latitude), Number(point.longitude));
      const pointMerged = gabungPintuTol(bacaTempatJson(point.tempat), bacaLandmarkJson(point.landmark), nearby, point.radius_meter);
      await prisma.sekitarTitik.updateMany({ where: { kunci, dipindai_pada: point.dipindai_pada }, data: {
        tempat: pointMerged.tempat as unknown as Prisma.InputJsonValue,
        landmark: pointMerged.landmark as unknown as Prisma.InputJsonValue,
        jumlah: pointMerged.tempat.length,
      } });
    }
    await serapKamusDariPindaian(row.id_property, {
      lat, lng, presisi: latest.presisi_titik ?? "TITIK",
    }, merged.landmark, merged.tempat, { kota: row.kota, provinsi: row.provinsi });
  }
  const relasi = await prisma.listingTempat.count({ where: {
    id_property: { in: rows.map((row) => row.id_property) }, tempat: { kelas: "PINTU_TOL" },
  } });
  return { diproses, gerbang: names.size, relasi };
}
