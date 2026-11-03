"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Bookmark,
  Building2,
  Clock3,
  Gavel,
  Home,
  KeyRound,
  Layers3,
  Ruler,
  Wallet,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import KeywordField from "@/components/search/KeywordField";
import LocationPicker from "@/components/search/LocationPicker";
import TypePicker from "@/components/search/TypePicker";
import { SearchRangeInputs } from "@/components/search/TabFilterFields";
import { DialogFrame } from "@/components/ui/dialog";
import SearchSubmitButton from "@/components/search/SearchSubmitButton";
import SearchSelect from "@/components/search/SearchSelect";
import { TYPE_DB_TO_DISPLAY, serializeTypes } from "@/lib/propertyType";
import {
  EMPTY_SEARCH_STATE,
  DURASI_OPTIONS,
  PROPERTY_ICONS,
  RANGE_PAIRS,
  formatIdNumber,
  parseRawNumber,
  typeOptionsFor,
  type RangeErrors,
  type RangeField,
  type SearchFormState,
} from "@/lib/searchTabs";
import {
  DEFAULT_DEAL_THRESHOLD,
  type DealFilters,
  type InvestorFeed,
  type TransactionType,
} from "@/lib/investor-deals";

const rangeState = (filters: DealFilters) => ({
  minPrice: formatIdNumber(
    filters.transactionType !== "SEWA" ? (filters.minPrice ?? "") : "",
  ),
  maxPrice: formatIdNumber(
    filters.transactionType !== "SEWA" ? (filters.maxPrice ?? "") : "",
  ),
  minRent: formatIdNumber(
    filters.transactionType === "SEWA" ? (filters.minPrice ?? "") : "",
  ),
  maxRent: formatIdNumber(
    filters.transactionType === "SEWA" ? (filters.maxPrice ?? "") : "",
  ),
  minLt: formatIdNumber(filters.minLand ?? ""),
  maxLt: formatIdNumber(filters.maxLand ?? ""),
});
const CATEGORIES = [
  { value: "ALL", label: "Semua", icon: Layers3 },
  { value: "PRIMARY", label: "Primary", icon: Building2 },
  { value: "LELANG", label: "Lelang", icon: Gavel },
  { value: "SECONDARY", label: "Secondary", icon: Home },
] as const;

function DiscountControl({
  id,
  label,
  value,
  amber = false,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  amber?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="investor-discount-control">
      <div className="investor-discount-label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className={amber ? "is-auction" : ""}>
          {value}%
        </output>
      </div>
      <input
        id={id}
        className={`investor-range ${amber ? "investor-range-amber" : ""}`}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-valuetext={`${value} persen`}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--range-fill": `${value}%` } as CSSProperties}
      />
    </div>
  );
}

/** Home owns the search controls. Investor supplies its feed adapter and city depth limit. */
export default function InvestorFilters({
  filters,
  metadata,
  updateFilters,
  onTransactionChange,
  setComposing,
  submitSearch,
  searching,
  advancedOpen,
  onAdvancedOpenChange,
  savedCount,
  children,
}: {
  filters: DealFilters;
  metadata: InvestorFeed | null;
  updateFilters: (value: Partial<DealFilters>) => void;
  onTransactionChange: (value: TransactionType) => void;
  setComposing: (value: boolean) => void;
  submitSearch: () => void;
  searching: boolean;
  advancedOpen: boolean;
  onAdvancedOpenChange: (open: boolean) => void;
  savedCount: number | null;
  children: ReactNode;
}) {
  const wrapper = useRef<HTMLDivElement>(null);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [ranges, setRanges] = useState(() => rangeState(filters));
  const [draft, setDraft] = useState(filters);
  const rent = filters.transactionType === "SEWA";
  const tab = rent ? "sewa" : "beli";
  const changeAdvancedOpen = (open: boolean) => {
    setOpenDropdown(null);
    if (open) {
      setDraft(filters);
      setRanges(rangeState(filters));
    }
    onAdvancedOpenChange(open);
  };
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        !target.closest("[data-search-portal]") &&
        !wrapper.current?.contains(target)
      )
        setOpenDropdown(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const trigger = wrapper.current?.querySelector<HTMLElement>(
        '[aria-expanded="true"]',
      );
      setOpenDropdown(null);
      trigger?.focus({ preventScroll: true });
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const city = metadata?.cities.find(
    (item) => item.id === filters.city || item.name === filters.city,
  );
  const state: SearchFormState = {
    ...EMPTY_SEARCH_STATE,
    ...ranges,
    keyword: filters.query,
    locations: filters.locations?.length
      ? filters.locations
      : filters.city
        ? [
            {
              id: city?.id || filters.city,
              name: city?.name || filters.city,
              level: "kota",
            },
          ]
        : [],
    types: (filters.propertyTypes || [])
      .map((type) => TYPE_DB_TO_DISPLAY[type])
      .filter(Boolean),
    durasi: draft.rentalPeriod || "",
  };
  const errors: RangeErrors = {};
  for (const key of rent ? (["rent"] as const) : (["price", "lt"] as const)) {
    const { min, max, unit } = RANGE_PAIRS[key];
    if (
      state[min] &&
      state[max] &&
      Number(parseRawNumber(state[min])) > Number(parseRawNumber(state[max]))
    )
      errors[key] = `Max harus ≥ ${state[min]}${unit}`;
  }
  const patch = (next: Partial<SearchFormState>) => {
    setRanges((previous) => ({
      ...previous,
      ...Object.fromEntries(
        Object.entries(next).filter(([key]) => key in previous),
      ),
    }));
    const values: Partial<DealFilters> = {};
    if (next.keyword !== undefined) values.query = next.keyword.slice(0, 150);
    if (next.locations !== undefined) {
      values.locations = next.locations.filter(
        (region) => region.level === "provinsi" || region.level === "kota",
      );
      values.city = "";
    }
    if (next.types !== undefined)
      values.propertyTypes = serializeTypes(next.types)
        .split(",")
        .filter(Boolean);
    if (next.durasi !== undefined)
      setDraft((previous) => ({
        ...previous,
        rentalPeriod: next.durasi as DealFilters["rentalPeriod"],
      }));
    if (Object.keys(values).length) updateFilters(values);
  };
  const onRangeChange = (field: RangeField, value: string) =>
    patch({ [field]: formatIdNumber(value) });
  const apply = () => {
    if (Object.values(errors).some(Boolean)) {
      onAdvancedOpenChange(true);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(
            '.investor-filter-dialog [aria-invalid="true"]',
          )
          ?.focus(),
      );
      return;
    }
    const number = (value: string) =>
      value ? Number(parseRawNumber(value)) : undefined;
    updateFilters({
      listingCategory: draft.listingCategory,
      minSpread: draft.minSpread,
      minDrop: draft.minDrop,
      upcomingOnly: draft.upcomingOnly,
      savedOnly: draft.savedOnly,
      rentalPeriod: draft.rentalPeriod,
      minPrice: number(rent ? state.minRent : state.minPrice),
      maxPrice: number(rent ? state.maxRent : state.maxPrice),
      minLand: rent ? undefined : number(state.minLt),
      maxLand: rent ? undefined : number(state.maxLt),
    });
    setOpenDropdown(null);
    submitSearch();
    changeAdvancedOpen(false);
  };
  const reset = () => {
    setRanges(
      rangeState({
        ...filters,
        minPrice: undefined,
        maxPrice: undefined,
        minLand: undefined,
        maxLand: undefined,
      }),
    );
    setDraft({
      ...filters,
      minPrice: undefined,
      maxPrice: undefined,
      minLand: undefined,
      maxLand: undefined,
      rentalPeriod: "",
      minSpread: DEFAULT_DEAL_THRESHOLD,
      minDrop: DEFAULT_DEAL_THRESHOLD,
      savedOnly: false,
      upcomingOnly: false,
      listingCategory: "ALL",
    });
    setOpenDropdown(null);
  };
  const activeCount = [
    filters.listingCategory && filters.listingCategory !== "ALL",
    filters.minPrice !== undefined || filters.maxPrice !== undefined,
    !rent && (filters.minLand !== undefined || filters.maxLand !== undefined),
    filters.minSpread !== DEFAULT_DEAL_THRESHOLD,
    !rent && filters.minDrop !== DEFAULT_DEAL_THRESHOLD,
    !rent && filters.upcomingOnly,
    rent && Boolean(filters.rentalPeriod),
    filters.savedOnly,
  ].filter(Boolean).length;
  return (
    <section
      aria-label="Filter peluang investasi"
      className="investor-home-search"
      ref={wrapper}
    >
      <div className="investor-home-search-bar">
        <div className="investor-search-field investor-search-city">
          <LocationPicker
            focusTone="neutral"
            theme="light"
            label="Kota / Kabupaten"
            value={state.locations}
            onChange={(locations) => patch({ locations })}
            open={openDropdown === "location"}
            onOpenChange={(open) => setOpenDropdown(open ? "location" : null)}
            maxLevel="kota"
          />
        </div>
        <div className="investor-search-keyword">
          <KeywordField
            id="investor-search"
            theme="light"
            label="Kelurahan"
            placeholder="Cari kelurahan…"
            animatedPlaceholder={false}
            width=""
            value={filters.query}
            onChange={(query) => updateFilters({ query: query.slice(0, 150) })}
            onSubmit={submitSearch}
            onFocusField={() => setOpenDropdown(null)}
            onComposingChange={setComposing}
            maxLength={150}
          />
        </div>
        <div className="investor-search-field investor-search-transaction">
          <SearchSelect
            theme="light"
            label="Transaksi"
            icon={rent ? <KeyRound size={19} /> : <Home size={19} />}
            value={filters.transactionType || "BELI"}
            options={[
              {
                value: "BELI",
                label: "Beli",
                id: "investor-transaction-beli",
                icon: <Home size={19} />,
              },
              {
                value: "SEWA",
                label: "Sewa",
                id: "investor-transaction-sewa",
                icon: <KeyRound size={19} />,
              },
            ]}
            open={openDropdown === "transaction"}
            onOpenChange={(open) =>
              setOpenDropdown(open ? "transaction" : null)
            }
            onChange={(value) => {
              setOpenDropdown(null);
              onTransactionChange(value as TransactionType);
            }}
          />
        </div>
        <div className="investor-search-field investor-search-type">
          <TypePicker
            theme="light"
            label="Jenis properti"
            value={state.types}
            onChange={(types) => patch({ types })}
            options={typeOptionsFor(tab)}
            icons={PROPERTY_ICONS}
            open={openDropdown === "type"}
            onOpenChange={(open) => setOpenDropdown(open ? "type" : null)}
          />
        </div>
        <div className="investor-search-submit">
          <SearchSubmitButton
            searching={searching}
            shaking={false}
            onClick={submitSearch}
            width=""
          />
        </div>
      </div>
      <div
        className="investor-filter-toolbar"
        role="group"
        aria-label="Kontrol hasil properti"
      >
        <button
          id="investor-filter-trigger"
          type="button"
          className={`investor-filter-trigger ${activeCount ? "is-active" : ""}`}
          aria-label="Filter tambahan"
          title="Filter tambahan"
          aria-haspopup="dialog"
          aria-expanded={advancedOpen}
          onClick={() => {
            changeAdvancedOpen(true);
          }}
        >
          <SlidersHorizontal size={15} />
          <span>Filter</span>
          {activeCount > 0 && <b>{activeCount}</b>}
        </button>
        {children}
      </div>
      <DialogFrame
        open={advancedOpen}
        onOpenChange={changeAdvancedOpen}
        title="Filter properti"
        description="Atur kategori, rentang harga, luas tanah dan ambang diskon."
        contentClassName="investor-surface investor-dialog investor-filter-dialog"
        overlayClassName="investor-dialog-overlay"
        closeClassName="investor-filter-close"
        focusFallbackId="investor-filter-trigger"
      >
        <header className="investor-filter-dialog-header">
          <SlidersHorizontal size={18} />
          <h2>Filter properti</h2>
        </header>
        <div className="investor-filter-dialog-body">
          <div className="investor-extra-search">
            {!rent && (
              <div
                className="investor-category-tabs"
                role="group"
                aria-label="Jenis listing"
              >
                {CATEGORIES.map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={(draft.listingCategory || "ALL") === value}
                    onClick={() =>
                      setDraft((previous) => ({
                        ...previous,
                        listingCategory: value,
                      }))
                    }
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="investor-extra-ranges">
              <fieldset>
                <legend>
                  <Wallet size={15} />
                  {rent ? "Harga sewa" : "Harga"}
                </legend>
                <SearchRangeInputs
                  theme="dark"
                  minValue={rent ? state.minRent : state.minPrice}
                  maxValue={rent ? state.maxRent : state.maxPrice}
                  onMin={(value) =>
                    onRangeChange(rent ? "minRent" : "minPrice", value)
                  }
                  onMax={(value) =>
                    onRangeChange(rent ? "maxRent" : "maxPrice", value)
                  }
                  error={rent ? errors.rent : errors.price}
                  onSubmit={apply}
                  ariaMin={rent ? "Harga sewa minimum" : "Harga minimum"}
                  ariaMax={rent ? "Harga sewa maksimum" : "Harga maksimum"}
                />
              </fieldset>
              {rent ? (
                <div className="investor-rental-period">
                  <SearchSelect
                    label="Periode sewa"
                    value={state.durasi || "ALL"}
                    icon={<Clock3 size={16} />}
                    options={[
                      { value: "ALL", label: "Semua periode" },
                      ...DURASI_OPTIONS.filter((option) => option.value).map(
                        (option) => ({
                          value: option.value,
                          label: option.label,
                        }),
                      ),
                    ]}
                    open={openDropdown === "duration"}
                    onOpenChange={(open) =>
                      setOpenDropdown(open ? "duration" : null)
                    }
                    onChange={(value) =>
                      patch({ durasi: value === "ALL" ? "" : value })
                    }
                    layer={2300}
                  />
                </div>
              ) : (
                <fieldset>
                  <legend>
                    <Ruler size={15} />
                    Luas tanah (m²)
                  </legend>
                  <SearchRangeInputs
                    theme="dark"
                    minValue={state.minLt}
                    maxValue={state.maxLt}
                    onMin={(value) => onRangeChange("minLt", value)}
                    onMax={(value) => onRangeChange("maxLt", value)}
                    error={errors.lt}
                    onSubmit={apply}
                    ariaMin="Luas tanah minimum"
                    ariaMax="Luas tanah maksimum"
                  />
                </fieldset>
              )}
            </div>
          </div>
          <div className="investor-control-ranges">
            <DiscountControl
              id="investor-min-spread"
              label={rent ? "Min. selisih tarif sewa" : "Min. diskon kelurahan"}
              value={draft.minSpread}
              onChange={(minSpread) =>
                setDraft((previous) => ({ ...previous, minSpread }))
              }
            />
            {!rent && (
              <DiscountControl
                id="investor-min-drop"
                label="Min. penurunan lelang"
                value={draft.minDrop}
                amber
                onChange={(minDrop) =>
                  setDraft((previous) => ({ ...previous, minDrop }))
                }
              />
            )}
          </div>
          <div className="investor-control-footer">
            <p className="investor-filter-rule">
              {filters.dataState !== "deals" ? (
                "Ambang diskon berlaku pada cakupan Worth-it."
              ) : rent ? (
                "Pembanding sewa dengan periode yang sama."
              ) : (
                <>
                  Diskon lelang <strong>ATAU</strong> diskon kelurahan.
                </>
              )}
            </p>
            {!rent && (
              <label className="investor-upcoming">
                <input
                  type="checkbox"
                  checked={draft.upcomingOnly}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      upcomingOnly: event.target.checked,
                    }))
                  }
                />
                Hari ini & mendatang
              </label>
            )}
          </div>
          <label className="investor-filter-saved">
            <Bookmark size={16} />
            <span>
              Hanya tersimpan{savedCount !== null ? ` (${savedCount})` : ""}
            </span>
            <input
              type="checkbox"
              aria-label="Tampilkan properti tersimpan"
              checked={draft.savedOnly}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  savedOnly: event.target.checked,
                }))
              }
            />
          </label>
        </div>
        <footer className="investor-filter-dialog-footer">
          <button
            type="button"
            className="investor-filter-reset"
            onClick={reset}
          >
            <RotateCcw size={14} />
            Reset filter
          </button>
          <button
            type="button"
            className="investor-primary"
            onClick={apply}
            disabled={searching}
          >
            Terapkan
          </button>
        </footer>
      </DialogFrame>
    </section>
  );
}
