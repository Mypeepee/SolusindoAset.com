"use client";

import type {
  CreateProjectFormValues,
  ListingOption,
  ModalTierTheme,
} from "./types";
import ListingSearchSection from "./components/step1/ListingSearchSection";

type Props = {
  form: CreateProjectFormValues;
  selectedListing?: ListingOption | null;
  theme: ModalTierTheme;
  updateField: <K extends keyof CreateProjectFormValues>(
    key: K,
    value: CreateProjectFormValues[K]
  ) => void;
  listingQuery: string;
  setListingQuery: (value: string) => void;
  listingLoading: boolean;
  listingError: string;
  listingResults: ListingOption[];
  onSelectListing: (item: ListingOption) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  inputClassName: string;
  textareaClassName: string;
};

export default function ProjectInfoStep({
  form,
  selectedListing,
  updateField,
  listingQuery,
  setListingQuery,
  listingLoading,
  listingError,
  listingResults,
  onSelectListing,
  onLoadMore,
  hasMore,
  inputClassName,
  textareaClassName,
}: Props) {
  return (
    <div className="space-y-5">
      <ListingSearchSection
        listingQuery={listingQuery}
        setListingQuery={setListingQuery}
        listingLoading={listingLoading}
        listingError={listingError}
        listingResults={listingResults}
        selectedId={form.id_listing}
        selectedListing={selectedListing}
        onSelect={onSelectListing}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        inputClassName={inputClassName}
      />

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-5">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Deskripsi Project
            </label>
            <textarea
              value={form.deskripsi_project}
              onChange={(e) => updateField("deskripsi_project", e.target.value)}
              rows={5}
              placeholder="Jelaskan gambaran project, kondisi aset, potensi exit, dan catatan penting lainnya..."
              className={textareaClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Jenis Pendanaan
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updateField("jenis_pendanaan", "TERBUKA")}
                className={`rounded-[20px] border px-4 py-4 text-left transition ${
                  form.jenis_pendanaan === "TERBUKA"
                    ? "border-white/20 bg-white/[0.09] text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]"
                }`}
              >
                <div className="text-sm font-semibold">Terbuka</div>
                <div className="mt-1 text-xs text-slate-400">
                  Project dapat diakses investor sesuai skema publik.
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateField("jenis_pendanaan", "TERTUTUP")}
                className={`rounded-[20px] border px-4 py-4 text-left transition ${
                  form.jenis_pendanaan === "TERTUTUP"
                    ? "border-white/20 bg-white/[0.09] text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]"
                }`}
              >
                <div className="text-sm font-semibold">Tertutup</div>
                <div className="mt-1 text-xs text-slate-400">
                  Hanya investor tertentu yang dapat mengakses project ini.
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}