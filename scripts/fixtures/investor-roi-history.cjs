/** Same HTTP shape as the public history endpoint; synthetic assets for UI QA. */
module.exports = (listing) => {
  const events = [
    ...listing.auctionHistory.map((event) => ({
      id: `${listing.id}-old`,
      price: event.limitPrice,
      date: event.date,
    })),
    {
      id: listing.id,
      price: listing.currentAuctionPrice,
      date: listing.auctionDate,
    },
  ];
  return {
    ok: true,
    total: events.length,
    total_sebidang: events.length,
    total_lot_terkait: 0,
    total_lain: events.length - 1,
    match: null,
    riwayat: events.map((event, index) => ({
      id_property: event.id,
      urutan: index + 1,
      is_current: event.id === listing.id,
      judul: listing.title,
      slug: "fixture-history",
      harga: event.price,
      nilai_limit_lelang: event.price,
      harga_efektif: event.price,
      uang_jaminan: null,
      tanggal_lelang: event.date,
      tanggal_dibuat: event.date,
      gambar_utama: listing.imageUrl,
      gambar_list: listing.imageUrls,
      status_tayang: "TERSEDIA",
      jenis_transaksi: "LELANG",
      kelurahan: listing.kelurahanName,
      kecamatan: listing.districtName,
      kota: listing.cityName,
      provinsi: listing.provinceName,
      legalitas: "SHM",
      nomor_legalitas: "123",
      nomor_legalitas_list: ["123"],
      nomor_cocok: ["123"],
      cakupan: "SAMA",
      alamat_lengkap: listing.address,
      luas_tanah: listing.landAreaSqm,
      luas_bangunan: null,
      link: null,
      id_agent: null,
      confidence: "TINGGI",
      alasan_cocok: [],
      duplikat_ids: [],
      delta_persen: index
        ? ((event.price - events[index - 1].price) / events[index - 1].price) *
          100
        : null,
    })),
  };
};
