import { ReactNode } from "react";
import "./hide-layout.css";

export default function ClosingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="hide-header-footer min-h-screen bg-black">
      {children}
    </div>
  );
}