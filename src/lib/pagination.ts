/**
 * Shared pagination + scroll helpers for listing grids
 * (dashboard listings, /Jual, /Lelang, /properti/[slug]).
 *
 * Pattern: always show at least 6 page numbers, with ellipsis,
 * e.g. `1 2 3 4 5 … last` or `1 … last-4 ... last` or `1 … cur±1 … last`.
 */

export type PageItem = number | "...";

/**
 * Returns the array of page numbers/ellipses to render.
 *  - totalPages <= 6 → show all
 *  - currentPage <= 4 → `1 2 3 4 5 … last`
 *  - currentPage >= totalPages - 3 → `1 … last-4 last-3 last-2 last-1 last`
 *  - middle → `1 … cur-1 cur cur+1 … last`
 */
export function getPaginationPages(
  currentPage: number,
  totalPages: number
): PageItem[] {
  if (totalPages <= 1) return [];
  if (totalPages <= 6)
    return Array.from({ length: totalPages }, (_, i) => i + 1);

  if (currentPage <= 4) return [1, 2, 3, 4, 5, "...", totalPages];

  if (currentPage >= totalPages - 3)
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
}

/**
 * Versi RINGKAS untuk layar kecil — maksimal 5 token agar pagination tidak
 * pernah melebihi lebar device, tapi tetap menampilkan nomor & konteks.
 *
 * Aturan (mirip pagination situs besar):
 *  - totalPages <= 5 → tampilkan semua
 *  - dekat awal  (cur ≤ 3)        → `1 2 3 … last`
 *  - dekat akhir (cur ≥ last-2)   → `1 … last-2 last-1 last`
 *  - tengah                       → `1 … cur … last`
 *
 * Catatan: ambang batas dipilih agar "…" tidak pernah dipakai untuk
 * menyembunyikan SATU halaman saja (mis. page 3 → `1 2 3 … last`, bukan
 * `1 … 3 … last`).
 */
export function getPaginationPagesCompact(
  currentPage: number,
  totalPages: number
): PageItem[] {
  if (totalPages <= 1) return [];
  if (totalPages <= 5)
    return Array.from({ length: totalPages }, (_, i) => i + 1);

  if (currentPage <= 3) return [1, 2, 3, "...", totalPages];

  if (currentPage >= totalPages - 2)
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];

  return [1, "...", currentPage, "...", totalPages];
}

/**
 * Find the nearest scrollable ancestor of an element. Dashboard layouts often
 * use a nested `overflow-y-auto` container instead of window scroll — falling
 * back to `window` would silently do nothing in that case.
 */
export function getScrollContainer(el: HTMLElement): HTMLElement | Window {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === "auto" || oy === "scroll") return node;
    node = node.parentElement;
  }
  return window;
}

/**
 * Smooth-scroll the correct scrollable ancestor so that `el` is positioned
 * `offset` pixels below the top of its container. Works for both window and
 * nested overflow scroll containers.
 */
export function smoothScrollToElement(el: HTMLElement, offset: number = 24) {
  if (typeof window === "undefined") return;
  const container = getScrollContainer(el);

  if (container instanceof Window) {
    const target = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  } else {
    const target =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop -
      offset;
    container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }
}
