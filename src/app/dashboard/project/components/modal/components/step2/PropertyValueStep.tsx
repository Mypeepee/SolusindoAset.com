"use client";

import { useEffect, useMemo } from "react";
import type {
  CreateProjectFormValues,
  ListingOption,
  ModalTierTheme,
} from "../../types";
import AcquisitionStructureCard from "./AcquisitionStructureCard";
import CMASection from "./CMASection";
import ProjectionSummaryCard from "./ProjectionSummaryCard";

type Props = {
  form: CreateProjectFormValues;
  selectedListing?: ListingOption | null;
  updateField: <K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) => void;
  inputClassName: string;
  theme: ModalTierTheme;
  hargaPembelianComputed: number;
  profitComputed: number;
  roiPercent: number;
};

export default function PropertyValueStep({
  form,
  selectedListing,
  updateField,
  inputClassName,
  theme,
  hargaPembelianComputed,
  profitComputed,
  roiPercent,
}: Props) {
  const isLelang = selectedListing?.jenis_transaksi === "LELANG";

  const listingBasisValue = useMemo(() => {
    if (!selectedListing) return 0;

    if (isLelang) {
      return Number(selectedListing.nilai_limit_lelang ?? 0);
    }

    return Number(
      selectedListing.harga_promo && Number(selectedListing.harga_promo) > 0
        ? selectedListing.harga_promo
        : selectedListing.harga ?? 0
    );
  }, [selectedListing, isLelang]);

  const sourceLabel = isLelang
    ? "Basis: Nilai Limit Lelang"
    : selectedListing?.harga_promo && Number(selectedListing.harga_promo) > 0
    ? "Basis: Harga Promo"
    : "Basis: Harga Jual";

  const biayaBalikNamaComputed = useMemo(() => {
    const basis =
      Number(form.nilai_limit_lelang || 0) + Number(form.spare_bidding || 0);
    return Math.round(basis * 0.085);
  }, [form.nilai_limit_lelang, form.spare_bidding]);

  useEffect(() => {
    if (Number(form.biaya_balik_nama || 0) !== biayaBalikNamaComputed) {
      updateField("biaya_balik_nama", biayaBalikNamaComputed);
    }
  }, [biayaBalikNamaComputed, form.biaya_balik_nama, updateField]);

  const cmaValidEntries = useMemo(() => {
    return (form.cma_entries || []).filter(
      (item) => Number(item.luas_tanah) > 0 && Number(item.harga) > 0
    );
  }, [form.cma_entries]);

  const avgHargaPerMeter = useMemo(() => {
    if (!cmaValidEntries.length) return 0;

    const values = cmaValidEntries.map(
      (item) => Number(item.harga) / Number(item.luas_tanah)
    );

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [cmaValidEntries]);

  const suggestedSellPrice = useMemo(() => {
    const subjectLandArea = Number(selectedListing?.luas_tanah ?? 0);
    if (avgHargaPerMeter <= 0 || subjectLandArea <= 0) return 0;
    return Math.round(avgHargaPerMeter * subjectLandArea);
  }, [avgHargaPerMeter, selectedListing?.luas_tanah]);

  return (
    <div className="space-y-5">
      <AcquisitionStructureCard
        form={form}
        selectedListing={selectedListing}
        isLelang={isLelang}
        listingBasisValue={listingBasisValue}
        sourceLabel={sourceLabel}
        biayaBalikNamaComputed={biayaBalikNamaComputed}
        updateField={updateField}
        inputClassName={inputClassName}
      />

      <CMASection
        form={form}
        selectedListing={selectedListing}
        updateField={updateField}
        inputClassName={inputClassName}
        avgHargaPerMeter={avgHargaPerMeter}
        suggestedSellPrice={suggestedSellPrice}
      />

      <ProjectionSummaryCard
        form={form}
        updateField={updateField}
        inputClassName={inputClassName}
        theme={theme}
        hargaPembelianComputed={hargaPembelianComputed}
        profitComputed={profitComputed}
        roiPercent={roiPercent}
        avgHargaPerMeter={avgHargaPerMeter}
        suggestedSellPrice={suggestedSellPrice}
      />
    </div>
  );
}