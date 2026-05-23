"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ClosingShell from "./components/ClosingShell";

export default function ClosingPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(
          `/api/closing/listing/${encodeURIComponent(String(id))}`,
          { cache: "no-store" }
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.message || "listing_not_found");
        }

        if (!alive) return;
        setPayload(json.data);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "error");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return <div className="p-6 text-zinc-200">Loading...</div>;
  }

  if (err || !payload?.listing) {
    return (
      <div className="p-6 text-zinc-200">
        Listing tidak ditemukan{" "}
        <span className="text-zinc-400">({String(err)})</span>
      </div>
    );
  }

  return (
    <ClosingShell
      listing={payload.listing}
      agent={payload.agent}
      leader={payload.leader}
      statusTransaksi={payload.mou?.status ?? null}
      mouPrefill={payload.mou ?? null}
    />
  );
}