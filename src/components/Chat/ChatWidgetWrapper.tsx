"use client";

import { usePathname } from "next/navigation";
import ChatWidget from "./ChatWidget";

export default function ChatWidgetWrapper() {
  const pathname = usePathname();

  // ⛔ Sementara di-hide di SEMUA halaman.
  // Untuk mengaktifkan lagi, hapus baris di bawah ini.
  const HIDE_EVERYWHERE = true;
  if (HIDE_EVERYWHERE) return null;

  // Hide chat widget di route tertentu
  const hideChat =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/closing") ||
    pathname.startsWith("/tambah-property"); // kalau kamu juga mau samain seperti contoh

  if (hideChat) return null;

  return <ChatWidget />;
}