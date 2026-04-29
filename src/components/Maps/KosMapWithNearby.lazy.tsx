"use client";

import dynamic from "next/dynamic";

const KosMapWithNearby = dynamic(() => import("./maps"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
      Memuat peta...
    </div>
  ),
});

export default KosMapWithNearby;
