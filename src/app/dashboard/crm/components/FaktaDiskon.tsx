import type { MetrikDiskon } from "@/lib/preferensiDiskon";

const persen = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const persenLengkap = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 15 });

export default function FaktaDiskon({ metrik }: { metrik?: MetrikDiskon | null }) {
  if (!metrik) return null;
  const fakta = [
    { label: "Diskon kelurahan", nilai: metrik.kelurahan, bantuan: "Selisih harga terhadap pembanding kelurahan yang dipakai filter.", warna: "bg-emerald-300/10 text-emerald-200" },
    { label: "Turun lelang", nilai: metrik.turunLelang, bantuan: "Penurunan dari harga lelang pertama ke harga putaran ini untuk aset yang sama.", warna: "bg-amber-300/10 text-amber-200" },
  ].filter(f => f.nilai !== null && Number.isFinite(f.nilai));
  if (!fakta.length) return null;
  return (
    <dl aria-label="Diskon aset sesuai preferensi" className="mt-2 flex flex-wrap gap-1.5 pl-8">
      {fakta.map(f => (
        <div key={f.label} title={`${f.bantuan} Nilai: ${persenLengkap.format(f.nilai!)}%.`} className={`flex flex-wrap items-baseline gap-x-1.5 rounded-lg px-2 py-1 text-[11px] ${f.warna}`}>
          <dt className="font-medium">{f.label}</dt>
          <dd className="font-extrabold tabular-nums">{persen.format(f.nilai!)}%</dd>
        </div>
      ))}
    </dl>
  );
}
