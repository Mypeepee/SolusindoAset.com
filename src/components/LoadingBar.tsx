"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function LoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Matikan loading setiap path berubah (navigasi selesai)
  useEffect(() => {
    setLoading(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [pathname]);

  // Nyalakan dari klik <a href> biasa
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href === window.location.pathname
      ) return;

      setLoading(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLoading(false), 4000);
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // Nyalakan dari programmatic navigation (router.push via custom event)
  useEffect(() => {
    function handleNavigate() {
      setLoading(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLoading(false), 4000);
    }

    window.addEventListener("navigate-start", handleNavigate);
    return () => window.removeEventListener("navigate-start", handleNavigate);
  }, []);

  return (
    <div
      aria-busy={loading}
      className={`fixed top-0 left-0 h-1 w-full z-[9999] transition-opacity duration-300 ${
        loading ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="h-full w-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 animate-[loadingBar_1s_linear_infinite]" />
      <style jsx>{`
        @keyframes loadingBar {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
