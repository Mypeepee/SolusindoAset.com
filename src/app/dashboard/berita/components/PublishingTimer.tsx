"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import styles from "./workspace.module.css";

export default function PublishingTimer({ value }: { value: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const minutes = value
    ? Math.ceil((Date.parse(`${value}:00+07:00`) - now) / 60000)
    : 0;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return (
    <span className={styles.scheduleHint} role="status">
      <Clock3 size={12} />
      {value && minutes > 0
        ? `Tayang dalam ${days ? `${days} hari ` : ""}${hours ? `${hours} jam ` : ""}${minutes % 60} menit · WIB`
        : "Pilih waktu mendatang untuk mengaktifkan jadwal."}
    </span>
  );
}
