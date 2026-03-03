import type { Listing } from "../../page";
import SectionCard from "../ui/SectionCard";
import Field from "../ui/Field";

function safe(s: any) {
  const v = (s ?? "").toString().trim();
  return v || "-";
}

export default function TabProperty({ listing }: { listing: Listing }) {
  const address =
    safe(listing.alamat_lengkap) !== "-"
      ? safe(listing.alamat_lengkap)
      : [listing.kelurahan, listing.kecamatan, listing.kota, listing.provinsi]
          .map(safe)
          .filter((x) => x !== "-")
          .join(", ") || listing.kota;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="lg:col-span-7 space-y-4">
        <SectionCard title="Identitas properti" subtitle="Informasi inti untuk closing">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID Property" value={String(listing.id_property)} />
            <Field label="Judul" value={safe(listing.judul)} />
            <Field label="Jenis transaksi" value={safe(listing.jenis_transaksi)} />
            <Field label="Status tayang" value={safe(listing.status_tayang)} />
            <Field label="Vendor" value={safe(listing.vendor)} />
            <Field label="Alamat" value={address} full />
          </div>
        </SectionCard>

        <SectionCard title="Spesifikasi" subtitle="Luas & detail fisik">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Luas tanah" value={safe(listing.luas_tanah) !== "-" ? `${safe(listing.luas_tanah)} m²` : "-"} />
            <Field label="Luas bangunan" value={safe(listing.luas_bangunan) !== "-" ? `${safe(listing.luas_bangunan)} m²` : "-"} />
          </div>
        </SectionCard>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <SectionCard title="Lokasi" subtitle="Ringkas">
          <div className="grid gap-3">
            <Field label="Kota" value={safe(listing.kota)} />
            <Field label="Kecamatan" value={safe(listing.kecamatan)} />
            <Field label="Kelurahan" value={safe(listing.kelurahan)} />
            <Field label="Provinsi" value={safe(listing.provinsi)} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}