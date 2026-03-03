"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export default function MobileDetailSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [anim, setAnim] = useState(false);

  useEffect(() => setMounted(true), []);

  // lock body scroll saat sheet open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // animate in/out
  useEffect(() => {
    if (!open) {
      setAnim(false);
      return;
    }
    const t = requestAnimationFrame(() => setAnim(true));
    return () => cancelAnimationFrame(t);
  }, [open]);

  const content = useMemo(() => {
    if (!open) return null;

    return (
      <div className="fixed inset-0 z-[999999]">
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cx(
            "absolute inset-0 bg-black/65 backdrop-blur-[6px] transition-opacity",
            anim ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Panel */}
        <div
          className={cx(
            "absolute inset-x-0 bottom-0",
            "h-[92vh] sm:h-[90vh]", // HP lebih tinggi, tablet sedikit lebih pendek
            "rounded-t-[28px] border border-white/10",
            "bg-zinc-950/92 backdrop-blur-xl",
            "shadow-[0_-20px_80px_rgba(0,0,0,0.65)]",
            "transition-transform duration-300 ease-out",
            anim ? "translate-y-0" : "translate-y-[16px]"
          )}
        >
          {/* Grab handle */}
          <div className="pt-3">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />
          </div>

          {/* Sticky header */}
          <div className="sticky top-0 z-10 mt-3 border-b border-white/10 bg-zinc-950/60 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {title ?? "Detail"}
                </div>
                {subtitle ? (
                  <div className="text-[12px] text-zinc-400 truncate">
                    {subtitle}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10 transition"
              >
                <Icon icon="solar:close-circle-linear" className="text-xl" />
              </button>
            </div>
          </div>

          {/* Body scroll */}
          <div className="h-[calc(92vh-64px)] sm:h-[calc(90vh-64px)] overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {children}
          </div>
        </div>
      </div>
    );
  }, [open, anim, onClose, title, subtitle, children]);

  if (!mounted) return null;
  return createPortal(content, document.body);
}