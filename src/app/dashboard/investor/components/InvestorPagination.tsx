import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPaginationPages, type PageItem } from "@/lib/pagination";
import { compactInvestorPages } from "@/lib/investor-presentation";

/** Controlled pagination: ranking belongs to the full server result, before slicing. */
export default function InvestorPagination({
  page,
  pageSize,
  pageCount,
  total,
  loading,
  onPage,
}: {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  loading: boolean;
  onPage: (page: number) => void;
}) {
  const number = (value: number) => value.toLocaleString("id-ID");
  const renderPages = (pages: PageItem[]) =>
    pages.map((value, i) =>
      value === "..." ? (
        <span key={`gap-${i}`} className="investor-page-gap" aria-hidden="true">
          …
        </span>
      ) : (
        <button
          key={value}
          type="button"
          aria-label={`Halaman ${value}`}
          aria-current={value === page ? "page" : undefined}
          disabled={loading}
          onClick={() => value !== page && onPage(value)}
        >
          {value}
        </button>
      ),
    );
  return (
    <nav
      className="investor-pagination"
      aria-label="Halaman peluang investasi"
      aria-busy={loading}
    >
      <p className="investor-page-range">
        <strong>
          {number((page - 1) * pageSize + 1)}–
          {number(Math.min(page * pageSize, total))}
        </strong>
        <span>dari {number(total)} properti</span>
        <span className="investor-page-size">{pageSize} / halaman</span>
      </p>
      {pageCount > 1 && (
        <div className="investor-page-tray">
          <button
            type="button"
            aria-label="Halaman sebelumnya"
            disabled={loading || page === 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft size={17} strokeWidth={1.4} aria-hidden="true" />
          </button>
          <div className="investor-page-numbers is-wide">
            {renderPages(getPaginationPages(page, pageCount))}
          </div>
          <div className="investor-page-numbers is-compact">
            {renderPages(compactInvestorPages(page, pageCount))}
          </div>
          <button
            type="button"
            aria-label="Halaman berikutnya"
            disabled={loading || page === pageCount}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRight size={17} strokeWidth={1.4} aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
