import { useRef } from "react";

export function useSwipe(onNext: () => void, onPrev: () => void, threshold = 50) {
  const startX = useRef<number>(0);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = startX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) < threshold) return;
    if (delta > 0) onNext();
    else onPrev();
  };

  return { onTouchStart, onTouchEnd };
}
