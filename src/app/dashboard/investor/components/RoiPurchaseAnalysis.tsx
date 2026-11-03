"use client";

import { useState } from "react";
import { ResaleScenario } from "./RoiScenarios";
import { ArrowUpRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  formatRupiah,
  type CmaValidationProof,
  type InvestorListing,
} from "@/lib/investor-deals";
import {
  calculatePurchase,
  defaultPurchaseAssumptions,
  isAuctionPurchase,
  purchaseFeeDefinitions,
} from "@/lib/investor-roi";

export default function RoiPurchaseAnalysis({
  listing,
  proof,
  unavailable = false,
}: {
  listing: InvestorListing;
  proof: CmaValidationProof | null;
  unavailable?: boolean;
}) {
  const defaults = defaultPurchaseAssumptions(
    listing.currentAuctionPrice,
    listing.listingCategory,
  );
  const initial = () => ({
    price: String(defaults.price),
    eviction: String(defaults.eviction),
    rates: Object.fromEntries(
      Object.entries(defaults.rates).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  });
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const number = (value: string) => (value.trim() === "" ? NaN : Number(value));
  const purchase = calculatePurchase(
    {
      price: number(form.price),
      eviction: number(form.eviction),
      rates: Object.fromEntries(
        Object.entries(form.rates).map(([key, value]) => [key, number(value)]),
      ),
    },
    listing.listingCategory,
  );
  const auction = isAuctionPurchase(listing.listingCategory);
  const changed =
    form.price !== String(defaults.price) ||
    form.eviction !== String(defaults.eviction) ||
    Object.entries(defaults.rates).some(
      ([key, value]) => form.rates[key] !== String(value),
    );
  const benchmark = unavailable ? null : proof?.benchmark;
  const minimum = benchmark ? proof?.minBaselinePricePerSqm : null;
  const fees = purchaseFeeDefinitions(listing.listingCategory);
  const inputClass = "investor-roi-input";
  return (
    <aside
      className="investor-roi-financials"
      aria-label="Biaya pembelian dan simulasi ROI"
    >
      <section
        className="investor-roi-purchase"
        aria-labelledby="investor-purchase-title"
      >
        <div className="investor-roi-section-heading">
          <h3 id="investor-purchase-title">Rincian pembelian</h3>
          <button
            type="button"
            className="investor-roi-text-button"
            aria-expanded={editing}
            aria-controls="investor-roi-assumptions"
            onClick={() => setEditing(!editing)}
          >
            <SlidersHorizontal size={13} strokeWidth={1.5} />
            {editing ? "Selesai" : "Ubah asumsi"}
          </button>
        </div>
        <p className="investor-roi-caption">
          {changed
            ? "Asumsi lokal diubah · listing tetap sesuai database"
            : "Terisi otomatis · asumsi biaya simulasi"}
        </p>
        {editing && (
          <form
            id="investor-roi-assumptions"
            className="investor-roi-assumptions"
            onSubmit={(event) => event.preventDefault()}
            noValidate
          >
            <label className="investor-roi-price-field">
              {auction
                ? "Nilai limit simulasi (Rp)"
                : "Harga beli simulasi (Rp)"}
              <input
                className={inputClass}
                id="investor-purchase-price"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={form.price}
                aria-invalid={
                  !Number.isSafeInteger(number(form.price)) ||
                  number(form.price) <= 0
                }
                onChange={(event) =>
                  setForm({ ...form, price: event.target.value })
                }
              />
            </label>
            {fees.map((fee) => (
              <label key={fee.code}>
                {fee.label} (%)
                <input
                  className={inputClass}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.rates[fee.code]}
                  aria-invalid={
                    !Number.isFinite(number(form.rates[fee.code])) ||
                    number(form.rates[fee.code]) < 0 ||
                    number(form.rates[fee.code]) > 100 ||
                    Math.abs(
                      number(form.rates[fee.code]) * 100 -
                        Math.round(number(form.rates[fee.code]) * 100),
                    ) > 1e-7
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      rates: { ...form.rates, [fee.code]: event.target.value },
                    })
                  }
                />
              </label>
            ))}
            {auction && (
              <label className="investor-roi-price-field">
                Pengosongan (Rp)
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={form.eviction}
                  aria-invalid={
                    !Number.isSafeInteger(number(form.eviction)) ||
                    number(form.eviction) < 0
                  }
                  onChange={(event) =>
                    setForm({ ...form, eviction: event.target.value })
                  }
                />
              </label>
            )}
            <button
              type="button"
              className="investor-roi-text-button"
              onClick={() => setForm(initial())}
            >
              <RotateCcw size={13} strokeWidth={1.5} />
              Reset asumsi
            </button>
          </form>
        )}
        {!purchase && (
          <p role="alert" className="investor-roi-notice">
            Isi harga positif dan biaya valid. Nominal harus Rupiah utuh; tarif
            0–100% dengan maksimal dua desimal.
          </p>
        )}
        {unavailable && (
          <p role="status" className="investor-roi-notice">
            Listing perlu dimuat ulang. Angka pembelian di bawah berasal dari
            snapshot dashboard.
          </p>
        )}
        <dl className="investor-roi-cost-lines">
          <div className="investor-roi-base">
            <dt>{auction ? "Nilai limit" : "Harga properti"}</dt>
            <dd data-cost="base">
              {purchase ? formatRupiah(purchase.price) : "—"}
            </dd>
          </div>
          {fees.map((fee) => (
            <div key={fee.code}>
              <dt>
                {fee.label}{" "}
                <span>
                  {Number.isFinite(number(form.rates[fee.code]))
                    ? `${number(form.rates[fee.code]).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`
                    : "—"}
                </span>
              </dt>
              <dd data-cost={fee.code}>
                {purchase
                  ? formatRupiah(
                      purchase.fees.find((item) => item.code === fee.code)!
                        .amount,
                    )
                  : "—"}
              </dd>
            </div>
          ))}
          <div className="investor-roi-subtotal">
            <dt>Subtotal dokumen</dt>
            <dd data-cost="documents">
              {purchase ? formatRupiah(purchase.documents) : "—"}
            </dd>
          </div>
          {auction && (
            <div>
              <dt>Pengosongan</dt>
              <dd data-cost="eviction">
                {purchase ? formatRupiah(purchase.eviction) : "—"}
              </dd>
            </div>
          )}
        </dl>
        <div
          className="investor-roi-total"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>Harga beli sesungguhnya</span>
          <strong data-cost="total">
            {purchase ? formatRupiah(purchase.total) : "—"}
          </strong>
          <small>
            {auction
              ? "Nilai limit + dokumen + pengosongan"
              : "Harga properti + BPHTB + AJB"}
          </small>
        </div>
        <p className="investor-roi-caption">
          Setiap biaya dibulatkan ke Rupiah, lalu dijumlahkan.
        </p>
      </section>
      <section
        aria-labelledby="investor-scenarios-title"
        className="investor-roi-projections"
      >
        <div className="investor-roi-section-heading">
          <h3 id="investor-scenarios-title">Simulasi harga jual</h3>
          <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <p className="investor-roi-caption">
          Harga/m² pembanding × luas tanah aset
        </p>
        <div
          className="investor-roi-scenarios"
          aria-live="polite"
          aria-atomic="true"
        >
          <ResaleScenario
            title="Rata-rata"
            pricePerSqm={benchmark?.avgPricePerSqm}
            listing={listing}
            total={unavailable ? null : (purchase?.total ?? null)}
          />
          <ResaleScenario
            title="Termurah"
            pricePerSqm={minimum}
            listing={listing}
            total={unavailable ? null : (purchase?.total ?? null)}
          />
        </div>
        {(!listing.landAreaSqm || !benchmark) && (
          <p className="investor-roi-caption">
            {!proof
              ? "Menunggu bukti CMA untuk menghitung skenario."
              : "Skenario jual dan ROI belum tersedia: luas tanah atau benchmark belum terverifikasi."}
          </p>
        )}
        {benchmark && !minimum && (
          <p className="investor-roi-caption">
            Harga/m² termurah belum tersedia dari sumber validasi.
          </p>
        )}
        {proof?.cheapestPeer && benchmark && (
          <a
            className="investor-roi-source"
            href={proof.cheapestPeer.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Lihat pembanding termurah{" "}
            <ArrowUpRight size={13} strokeWidth={1.5} />
          </a>
        )}
        <p className="investor-roi-footnote">
          ROI = laba ÷ harga beli sesungguhnya. Laba memperhitungkan biaya
          pembelian di atas, belum mencakup biaya penjualan di luar daftar.
        </p>
      </section>
    </aside>
  );
}
