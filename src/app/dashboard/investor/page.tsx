import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { isOwner } from "@/lib/sessionJabatan";
import InvestorDashboard from "./components/InvestorDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor Deals | Solusindo Aset" };

export default async function InvestorPage() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.id ||
    session.user.peran !== "AGENT" ||
    !isOwner(session.user)
  ) {
    redirect("/dashboard?reason=forbidden");
  }
  return <InvestorDashboard bookmarkScope={session.user.id} />;
}
