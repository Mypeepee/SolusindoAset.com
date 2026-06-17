"use client";

import { useRouter } from "next/navigation";
import ForgotPasswordFlow from "@/components/Auth/ForgotPassword/ForgotPasswordFlow";

export default function ForgotPasswordPage() {
  const router = useRouter();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#04100B] px-4 py-28">
      {/* ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(16,185,129,0.14),transparent_70%)]" />
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[140px]" />
        <div className="absolute bottom-0 -left-24 h-[300px] w-[300px] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#181818]/90 p-8 shadow-2xl backdrop-blur-xl">
        <ForgotPasswordFlow onBackToSignin={() => router.push("/signin")} onClose={() => router.push("/")} />
      </div>
    </main>
  );
}
