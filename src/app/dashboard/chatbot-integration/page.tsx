import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveChatbotOwner } from "@/lib/chatbot/server-access";
import ChatbotIntegration from "./components/ChatbotIntegration";

export const metadata: Metadata = {
  title: "Bot Integration · Solusindo Aset",
  description: "Kelola koneksi WhatsApp, pantau aktivitas asisten, dan lanjutkan percakapan yang membutuhkan Anda.",
};

export default async function ChatbotIntegrationPage() {
  const access = await resolveChatbotOwner();
  if (access.status === 401) redirect("/signin?callbackUrl=%2Fdashboard%2Fchatbot-integration");
  if (access.status !== 200) redirect("/dashboard");
  return <ChatbotIntegration />;
}
