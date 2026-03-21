"use client";

import type {
  CreateProjectFormValues,
  ListingOption,
  ModalTierTheme,
} from "../../types";
import ListingSearchSection from "./ListingSearchSection";
import ProjectBasicsForm from "./ProjectBasicsForm";

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

export default function StepOneProperty(props: Props) {
  const {
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
  } = props;

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

      <ProjectBasicsForm
        form={form}
        updateField={updateField}
        inputClassName={inputClassName}
        textareaClassName={textareaClassName}
      />
    </div>
  );
}