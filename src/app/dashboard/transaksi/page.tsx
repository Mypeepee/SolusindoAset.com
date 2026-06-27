// src/app/dashboard/transaksi/page.tsx
import TransaksiPageClient from "./components/TransaksiPageClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const jabatan = (session?.user as any)?.jabatan ?? null;
  return <TransaksiPageClient jabatan={jabatan} />;
}
