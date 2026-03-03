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
  actions, // ✅ sticky bottom actions
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
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
            "absolute inset-0 bg-black/70 backdrop-blur-[8px] transition-opacity duration-200",
            anim ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Panel wrapper: center on tablet, full on phone */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-2 sm:px-4">
          <div
            className={cx(
              // ✅ Centered look for tablet: max width
              "w-full sm:max-w-[720px] md:max-w-[820px]",
              // ✅ Height: phone tinggi, tablet sedikit lebih pendek
              "h-[92vh] sm:h-[88vh]",
              // ✅ rounded + border + glass
              "rounded-t-[28px] border border-white/10",
              "bg-zinc-950/90 backdrop-blur-xl",
              "shadow-[0_-20px_80px_rgba(0,0,0,0.70)]",
              // ✅ animation
              "transition-transform duration-300 ease-out",
              anim ? "translate-y-0" : "translate-y-[18px]"
            )}
          >
            {/* top glow line biar futuristic */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[28px] bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent" />

            {/* Grab handle */}
            <div className="pt-3">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/15" />
            </div>

            {/* Sticky header */}
            <div className="sticky top-0 z-20 mt-3 border-b border-white/10 bg-zinc-950/65 backdrop-blur-xl">
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

            {/* Body scroll (important: padding bottom for action bar) */}
            <div
              className={cx(
                "overflow-y-auto px-4 pt-4",
                // ✅ kasih ruang supaya konten ga ketutup sticky actions
                actions
                  ? "pb-[calc(96px+env(safe-area-inset-bottom))]"
                  : "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                "h-[calc(92vh-64px)] sm:h-[calc(88vh-64px)]"
              )}
            >
              {children}
            </div>

            {/* ✅ Sticky bottom actions: tombol closing selalu keliatan */}
            {actions ? (
              <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-zinc-950/70 backdrop-blur-xl">
                <div className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  {actions}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }, [open, anim, onClose, title, subtitle, children, actions]);

  if (!mounted) return null;
  return createPortal(content, document.body);
}