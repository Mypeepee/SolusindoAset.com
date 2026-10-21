"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpRight as OpenArrow,
  type LucideIcon,
} from "lucide-react";
import type { Activity } from "./workspace";
import styles from "./workspace.module.css";

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
  activity,
  status,
  loading,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  active: boolean;
  onClick: () => void;
  activity: Activity[];
  status?: string;
  loading: boolean;
}) {
  const now = Date.now();
  const rows = activity.filter((row) => !status || row.status === status);
  const recent = rows.filter(
    (row) => now - Date.parse(row.date) < 7 * 86400000,
  ).length;
  const previous = rows.length - recent;
  const change = previous
    ? Math.round(((recent - previous) / previous) * 100)
    : null;
  const days = Array.from(
    { length: 7 },
    (_, index) =>
      rows.filter((row) => {
        const age = Math.floor((now - Date.parse(row.date)) / 86400000);
        return age === 6 - index;
      }).length,
  );
  const max = Math.max(1, ...days);
  return (
    <button
      type="button"
      className={`${styles.statCard} ${active ? styles.statActive : ""}`}
      onClick={onClick}
      aria-pressed={active}
      style={{ "--stat-color": tone } as React.CSSProperties}
    >
      <div className={styles.statTop}>
        <span>{label}</span>
        <span className={styles.statIcon}>
          <Icon size={16} strokeWidth={1.6} />
        </span>
      </div>
      <div className={styles.statMiddle}>
        {loading ? (
          <span className={`${styles.skeleton} h-9 w-16`} />
        ) : (
          <strong>{value.toLocaleString("id-ID")}</strong>
        )}
        <div className={styles.miniBars} aria-hidden="true">
          {days.map((day, index) => (
            <i
              key={index}
              style={{
                height: `${Math.max(8, (day / max) * 100)}%`,
                opacity: day ? 0.4 + index * 0.09 : 0.13,
              }}
            />
          ))}
        </div>
      </div>
      <div className={styles.statBottom}>
        <span
          className={
            change !== null && change < 0 ? styles.trendDown : styles.trendUp
          }
        >
          {change !== null ? (
            <>
              {change < 0 ? (
                <ArrowDownRight size={12} />
              ) : (
                <ArrowUpRight size={12} />
              )}
              {Math.abs(change)}%
            </>
          ) : (
            <>+{recent}</>
          )}
        </span>
        <span>artikel baru · 7 hari</span>
        <OpenArrow size={13} className={styles.statArrow} />
      </div>
    </button>
  );
}
