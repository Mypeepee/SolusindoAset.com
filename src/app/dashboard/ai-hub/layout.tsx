import type { ReactNode } from "react";
import { ScraperProvider } from "@/app/dashboard/components/scraper-context";

// Halaman AI Hub interaktif & memakai context (useScraper) — render dinamis,
// jangan di-prerender statis saat build.
export const dynamic = "force-dynamic";

export default function AiHubLayout({ children }: { children: ReactNode }) {
  return <ScraperProvider>{children}</ScraperProvider>;
}
