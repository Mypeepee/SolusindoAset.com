"use client";

import { motion, useReducedMotion } from "framer-motion";
import styles from "./marketing-header.module.css";
import {
  CalendarClock,
  Chart,
  Rows,
  Settings2,
  Instagram,
} from "./MarketingIcons";
export type MarketingTab =
  "planner" | "campaign" | "instagram" | "analitik" | "pengaturan";
export const tabs: {
  id: MarketingTab;
  name: string;
  icon: typeof CalendarClock;
}[] = [
  { id: "planner", name: "Planner", icon: CalendarClock },
  { id: "campaign", name: "Campaign", icon: Rows },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "analitik", name: "Analitik", icon: Chart },
  { id: "pengaturan", name: "Pengaturan", icon: Settings2 },
];
export default function MarketingNavigation({
  tab,
  dirty,
  onChange,
  campaignDirty = false,
  disabled = false,
  allowedTabs,
}: {
  tab: MarketingTab;
  dirty: boolean;
  onChange: (tab: MarketingTab) => void;
  campaignDirty?: boolean;
  disabled?: boolean;
  allowedTabs?: MarketingTab[];
}) {
  const reduced = useReducedMotion();
  return (
    <nav className={"marketing-tabs " + styles.tabs} aria-label="Bagian Pemasaran">
      {tabs.map(({ id, name, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={styles.tab}
          data-section={id}
          disabled={disabled || (!!allowedTabs && !allowedTabs.includes(id))}
          title={
            allowedTabs && !allowedTabs.includes(id)
              ? "Keluar dari simulasi untuk membuka bagian ini"
              : undefined
          }
          aria-current={tab === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          <span className={styles.tabIcon}>
            <Icon size={18} />
          </span>
          <span className={styles.tabLabel}>{name}</span>
          {((id === "pengaturan" && dirty) ||
            (id === "campaign" && campaignDirty)) && (
            <span
              className={styles.unsaved}
              aria-label="Perubahan belum disimpan"
            />
          )}
          {tab === id && (
            <motion.span
              className={"marketing-tab-indicator " + styles.indicator}
              layoutId="marketing-tab-indicator"
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 360, damping: 34 }
              }
            />
          )}
        </button>
      ))}
    </nav>
  );
}
