"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import styles from "./workspace.module.css";

export default function WorkspaceDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "modal",
  hideClose = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  variant?: "modal" | "drawer" | "editor";
  hideClose?: boolean;
}) {
  const restoreFocus = useRestorableFocus();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={`${styles.dialog} ${styles[variant]}`}
          onOpenAutoFocus={() => restoreFocus.capture()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus.restore();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {description}
          </Dialog.Description>
          {!hideClose && (
            <Dialog.Close
              className={styles.dialogClose}
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

// Dialogs are opened by several row actions, so restore the initiating control explicitly.
function useRestorableFocus() {
  const previous = useRef<HTMLElement | null>(null);
  return {
    capture: () => {
      previous.current = document.activeElement as HTMLElement;
    },
    restore: () => {
      if (previous.current?.isConnected) previous.current.focus();
      else document.getElementById("berita-workspace-heading")?.focus();
    },
  };
}
