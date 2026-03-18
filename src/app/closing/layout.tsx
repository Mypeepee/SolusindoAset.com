import { ReactNode } from "react";
import "./hide-layout.css";

export default function ClosingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="hide-header-footer min-h-screen bg-black pt-14 sm:pt-16 md:pt-12 lg:pt-0">
      {children}
    </div>
  );
}