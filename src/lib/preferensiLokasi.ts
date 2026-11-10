/** Shared guard for new saves and legacy matching: names alone are ambiguous. */
export function masalahIndukLokasi(p: {
  loc_kota?: string | null;
  loc_kecamatan?: string | null;
  loc_kelurahan?: string | null;
}): string | null {
  if (p.loc_kelurahan?.trim() && (!p.loc_kecamatan?.trim() || !p.loc_kota?.trim())) {
    return `Pilih ulang kelurahan ${p.loc_kelurahan} beserta kecamatan dan kota/kabupatennya.`;
  }
  if (p.loc_kecamatan?.trim() && !p.loc_kota?.trim()) {
    return `Pilih ulang kecamatan ${p.loc_kecamatan} beserta kota/kabupatennya.`;
  }
  return null;
}
