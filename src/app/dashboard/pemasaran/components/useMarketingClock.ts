"use client";
import { useEffect, useState } from "react";

/** Keep lifecycle labels and action permissions current in an open workspace. */
export default function useMarketingClock(fixed?: string | Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (fixed) return;
    const update = () => setNow(new Date());
    const visible = () => {
      if (!document.hidden) update();
    };
    const timer = window.setInterval(visible, 30000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", update);
    };
  }, [fixed]);
  return fixed ? new Date(fixed) : now;
}
