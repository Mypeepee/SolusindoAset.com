import { useRef, type TouchEvent } from "react";

export function useSwipe(
  onNext: () => void,
  onPrev: () => void,
  threshold = 50,
  options: {
    axisRatio?: number;
    ignoreInteractive?: boolean;
    onInteractionChange?: (active: boolean) => void;
  } = {},
) {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {
      start.current = null;
      options.onInteractionChange?.(false);
      return;
    }
    if (
      options.ignoreInteractive &&
      (e.target as Element).closest(
        "button, a, input, textarea, select, [contenteditable]",
      )
    )
      return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    options.onInteractionChange?.(true);
  };

  const onTouchCancel = () => {
    start.current = null;
    options.onInteractionChange?.(false);
  };

  const onTouchEnd = (e: TouchEvent) => {
    const origin = start.current;
    onTouchCancel();
    if (!origin || !e.changedTouches[0]) return;
    const delta = origin.x - e.changedTouches[0].clientX;
    const vertical = origin.y - e.changedTouches[0].clientY;
    if (
      Math.abs(delta) < threshold ||
      Math.abs(delta) <= Math.abs(vertical) * (options.axisRatio ?? 0)
    )
      return;
    if (delta > 0) onNext();
    else onPrev();
  };

  return { onTouchStart, onTouchEnd, onTouchCancel };
}
