"use client";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import type { TocItem } from "@/lib/renderArticle";

/* Reading progress bar pinned to the very top of the viewport. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(100, (window.scrollY / h) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-white/5">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function useShareUrl() {
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  return url;
}

const SHARE_BTN =
  "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-gray-400 transition-all hover:scale-105";

/* Sticky vertical share rail (desktop). */
export function ShareRail({ title }: { title: string }) {
  const url = useShareUrl();
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tautan disalin");
    } catch {
      toast.error("Gagal menyalin tautan");
    }
  };

  return (
    <div className="sticky top-28 flex flex-col items-center gap-3">
      <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
        Bagikan
      </span>
      <a
        href={`https://wa.me/?text=${encTitle}%20${enc}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${SHARE_BTN} hover:border-[#25D366]/50 hover:bg-[#25D366]/15 hover:text-[#25D366]`}
        aria-label="Bagikan ke WhatsApp"
      >
        <Icon icon="ri:whatsapp-fill" width="18" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${SHARE_BTN} hover:border-[#1877F2]/50 hover:bg-[#1877F2]/15 hover:text-[#1877F2]`}
        aria-label="Bagikan ke Facebook"
      >
        <Icon icon="ri:facebook-fill" width="18" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${enc}&text=${encTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${SHARE_BTN} hover:border-white/40 hover:bg-white/10 hover:text-white`}
        aria-label="Bagikan ke X"
      >
        <Icon icon="ri:twitter-x-fill" width="16" />
      </a>
      <a
        href={`https://t.me/share/url?url=${enc}&text=${encTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${SHARE_BTN} hover:border-[#0088cc]/50 hover:bg-[#0088cc]/15 hover:text-[#0088cc]`}
        aria-label="Bagikan ke Telegram"
      >
        <Icon icon="ri:telegram-fill" width="18" />
      </a>
      <button
        onClick={copy}
        className={`${SHARE_BTN} hover:border-emerald-400/50 hover:bg-emerald-400/15 hover:text-emerald-300`}
        aria-label="Salin tautan"
      >
        <Icon icon="solar:link-bold" width="18" />
      </button>
    </div>
  );
}

/* Horizontal share bar for mobile (below the article). */
export function ShareBarMobile({ title }: { title: string }) {
  const url = useShareUrl();
  const enc = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* dismissed */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Tautan disalin");
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="flex items-center gap-2.5 lg:hidden">
      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Bagikan</span>
      <a href={`https://wa.me/?text=${encTitle}%20${enc}`} target="_blank" rel="noopener noreferrer" className={`${SHARE_BTN} h-9 w-9 hover:text-[#25D366]`}>
        <Icon icon="ri:whatsapp-fill" width="16" />
      </a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`} target="_blank" rel="noopener noreferrer" className={`${SHARE_BTN} h-9 w-9 hover:text-[#1877F2]`}>
        <Icon icon="ri:facebook-fill" width="16" />
      </a>
      <button onClick={nativeShare} className={`${SHARE_BTN} h-9 w-9 hover:text-emerald-300`} aria-label="Bagikan">
        <Icon icon="solar:share-bold" width="16" />
      </button>
    </div>
  );
}

/* Sticky table of contents with scroll-spy (desktop). */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id || "");

  useEffect(() => {
    if (!items.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -65% 0px", threshold: 0 }
    );
    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  const onClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
      setActive(id);
    }
  };

  if (!items.length) return null;

  return (
    <div className="sticky top-28">
      <h4 className="mb-3 border-l-2 border-emerald-400 pl-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
        Daftar Isi
      </h4>
      <ul className="space-y-1 border-l border-white/10">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              onClick={(e) => onClick(e, it.id)}
              className={`-ml-px block border-l-2 py-1.5 text-sm transition-colors ${
                it.level === 3 ? "pl-6" : "pl-3"
              } ${
                active === it.id
                  ? "border-emerald-400 font-medium text-emerald-300"
                  : "border-transparent text-gray-500 hover:text-white"
              }`}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
