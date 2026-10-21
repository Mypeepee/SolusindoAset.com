import type { Metadata } from "next";
import localFont from "next/font/local";
import { redirect } from "next/navigation";
import { resolveChatbotOwner } from "@/lib/chatbot/server-access";
import BotPlayground from "./components/BotPlayground";

const inter = localFont({
  src: "../../../../public/fonts/inter/InterVariable.woff2",
  display: "swap",
  weight: "100 900",
  fallback: ["system-ui", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "sans-serif"],
});

export const metadata: Metadata = { title: "AI Bot Playground · Solusindo Aset" };

export default async function BotPlaygroundPage() {
  const access = await resolveChatbotOwner();
  if (access.status === 401) redirect("/signin?callbackUrl=%2Fdashboard%2Fchatbot-playground");
  if (access.status !== 200) redirect("/dashboard");
  return <div className={inter.className}><BotPlayground /></div>;
}
