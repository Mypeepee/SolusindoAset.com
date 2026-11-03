"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./switch.module.css";

/** Native checkbox behavior with a consistent, touch-sized switch presentation. */
export const Switch = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">
>(function Switch({ className = "", ...props }, ref) {
  return (
    <span className={styles.root + " " + className}>
      <input
        {...props}
        ref={ref}
        type="checkbox"
        role="switch"
        className={styles.input}
      />
      <span className={styles.track} aria-hidden="true">
        <span />
      </span>
    </span>
  );
});
