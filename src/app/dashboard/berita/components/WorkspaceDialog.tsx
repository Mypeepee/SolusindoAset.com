"use client";

import { type ReactNode } from "react";
import { DialogFrame } from "@/components/ui/dialog";
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
  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      overlayClassName={styles.overlay}
      contentClassName={`${styles.dialog} ${styles[variant]}`}
      closeClassName={styles.dialogClose}
      hideClose={hideClose}
      focusFallbackId="berita-workspace-heading"
    >
      {children}
    </DialogFrame>
  );
}
