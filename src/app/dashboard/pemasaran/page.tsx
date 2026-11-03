import { redirect } from "next/navigation";
import { resolveChatbotOwner } from "@/lib/chatbot/server-access";
import MarketingDashboard from "./MarketingDashboard";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pemasaran | Solusindo Aset" };
export default async function MarketingPage() {
  if ((await resolveChatbotOwner()).status !== 200)
    redirect("/dashboard?reason=forbidden");
  return <MarketingDashboard />;
}
