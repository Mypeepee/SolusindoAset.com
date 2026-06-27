"use client";

import { usePathname } from "next/navigation";
import Header from "./index";

export default function HeaderWrapper() {
  const pathname = usePathname();
  if (pathname?.startsWith("/dashboard")) return null;
  return <Header />;
}
