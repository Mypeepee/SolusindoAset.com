import type { TempatTerdekat } from "../nearbyPlaces";
import type { TempatLandmark } from "./landmark";

/** Pintu tol 5 km tetap terpisah dari fasilitas dalam radius harian aset. */
export function gabungPintuTol(
  tempat: TempatTerdekat[],
  landmark: TempatLandmark[],
  gerbang: TempatLandmark[],
  radius: number,
) {
  const toll = gerbang.filter((place) => place.kelas === "PINTU_TOL");
  return {
    landmark: [...landmark.filter((place) => place.kelas !== "PINTU_TOL"), ...toll]
      .sort((a, b) => a.jarak - b.jarak),
    tempat: [...tempat.filter((place) => place.kategori !== "toll"),
      ...toll.filter((place) => place.jarak <= radius).map((place): TempatTerdekat => ({
        id: place.id, nama: place.nama, lat: place.lat, lon: place.lon,
        jarak: place.jarak, kategori: "toll",
      })),
    ].sort((a, b) => a.jarak - b.jarak),
  };
}
