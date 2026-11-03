"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import styles from "./dialog.module.css";

/** Shared Radix focus, dismissal, and restoration for application dialogs. */
export function DialogFrame({
  open,
  onOpenChange,
  title,
  description,
  children,
  hideClose = false,
  contentClassName,
  overlayClassName,
  closeClassName,
  focusFallbackId,
  initialFocusRef,
  returnFocusRef,
  layer,
  contentStyle,
  contentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  hideClose?: boolean;
  contentClassName?: string;
  overlayClassName?: string;
  closeClassName?: string;
  focusFallbackId?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  /** Authored triggers outside Dialog.Trigger can name their focus return target. */
  returnFocusRef?: RefObject<HTMLElement>;
  layer?: number;
  contentStyle?: CSSProperties;
  contentId?: string;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={overlayClassName || styles.overlay}
          style={layer === undefined ? undefined : { zIndex: layer }}
        />
        <Dialog.Content
          id={contentId}
          className={contentClassName || styles.content}
          style={{
            ...contentStyle,
            ...(layer === undefined ? {} : { zIndex: layer + 1 }),
          }}
          onOpenAutoFocus={(event) => {
            previousFocus.current = document.activeElement as HTMLElement;
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus({ preventScroll: true });
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocusRef?.current?.isConnected)
              returnFocusRef.current.focus();
            else if (previousFocus.current?.isConnected)
              previousFocus.current.focus();
            else if (focusFallbackId)
              document.getElementById(focusFallbackId)?.focus();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {description}
          </Dialog.Description>
          {!hideClose && (
            <Dialog.Close
              className={closeClassName || styles.close}
              aria-label="Tutup dialog"
            >
              <X size={18} />
            </Dialog.Close>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
