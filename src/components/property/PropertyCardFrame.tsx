import type { HTMLAttributes } from "react";

/** Canonical photo dimensions used by the public Lelang listing card. */
export const PROPERTY_CARD_PHOTO_CLASS =
  "relative w-full h-60 md:h-64 overflow-hidden";

/** Shared visual shell; business variants supply their relevant property facts. */
export function PropertyCardFrame({
  as: Element = "div",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "div" | "article" }) {
  return (
    <Element
      {...props}
      data-property-card="true"
      className={`bg-[#111111] rounded-3xl overflow-hidden group transition-all duration-300 flex flex-col h-full ${className}`}
    />
  );
}
