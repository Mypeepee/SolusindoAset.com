"use client";

import { useSession } from "next-auth/react";

export default function WelcomeCard() {
  const { data: session } = useSession();
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <p className="text-xs text-slate-400 mb-1">{today}</p>
      <h1 className="text-2xl font-bold text-white">
        Good morning,{" "}
        <span className="text-emerald-400">
          {session?.user?.name || "Owner"}
        </span>
        !
      </h1>
    </div>
  );
}
