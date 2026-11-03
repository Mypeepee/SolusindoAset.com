"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Deliberate mouse hover, click, Enter, and Space share one validation action. */
export default function CmaProofTrigger({
  onOpen,
  children,
  className,
  label,
}: {
  onOpen: () => void;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const button = useRef<HTMLButtonElement>(null);
  const hoverOpened = useRef(false);
  const hoverPending = useRef(false);
  const cancel = () => {
    clearTimeout(timer.current);
    hoverPending.current = false;
  };
  useEffect(() => cancel, []);
  return (
    <button
      ref={button}
      type="button"
      className={className}
      aria-label={label}
      aria-haspopup="dialog"
      onPointerMove={(event) => {
        if (
          event.pointerType !== "mouse" ||
          hoverOpened.current ||
          hoverPending.current ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        cancel();
        hoverPending.current = true;
        timer.current = setTimeout(() => {
          hoverPending.current = false;
          hoverOpened.current = true;
          button.current?.focus({ preventScroll: true });
          onOpen();
        }, 550);
      }}
      onPointerLeave={(event) => {
        cancel();
        const rect = event.currentTarget.getBoundingClientRect();
        // The modal covering this trigger is not a deliberate pointer exit.
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          hoverOpened.current = false;
      }}
      onBlur={cancel}
      onClick={() => {
        cancel();
        onOpen();
      }}
    >
      {children}
    </button>
  );
}
