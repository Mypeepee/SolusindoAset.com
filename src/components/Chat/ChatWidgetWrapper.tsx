"use client";

import { usePathname } from "next/navigation";
import ChatWidget from "./ChatWidget";

export default function ChatWidgetWrapper() {
  const pathname = usePathname();

  // Hide di dashboard
  if (pathname.startsWith("/dashboard")) return null;

  return <ChatWidget />;
}