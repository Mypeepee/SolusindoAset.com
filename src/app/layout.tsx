import type { Metadata } from "next";
import localFont from "next/font/local";
import dynamic from "next/dynamic";

import "./globals.css";

import HeaderWrapper from "@/components/Layout/Header/HeaderWrapper";
import FooterWrapper from "@/components/Layout/Footer/FooterWrapper";

import { ThemeProvider } from "next-themes";
import Aoscompo from "@/utils/aos";

import ChatWidgetWrapper from "@/components/Chat/ChatWidgetWrapper";
import { ChatProvider } from "@/context/ChatContext";
import NextAuthProvider from "@/providers/NextAuthProvider";
import { Toaster } from "sonner";
import LoadingBar from "@/components/LoadingBar";

import "@/lib/cron";

const ScrollToTop = dynamic(() => import("@/components/ScrollToTop"), { ssr: false });

const dmSans = localFont({
  src: "../../public/fonts/DMSans_24pt-Bold.ttf",
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: "Solusindo Aset - Satu Aplikasi untuk Semua Kebutuhan Properti Anda",
  description:
    "Platform terintegrasi untuk jual beli properti Primary, Secondary, dan Aset Lelang. Temukan investasi properti terbaik dan aman bersama Solusindo Aset.",
  icons: { icon: "/images/logo/LogoSolusindoPremier.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      {/* kalau kamu pakai tailwind dan ingin variable font: tambahkan dmSans.variable di className html */}
      <body className={dmSans.className}>
        <LoadingBar />

        <ThemeProvider attribute="class" enableSystem defaultTheme="system">
          <NextAuthProvider>
            <ChatProvider>
              <Aoscompo>
                <HeaderWrapper />
                {children}
                <FooterWrapper />
              </Aoscompo>

              <ScrollToTop />
              <ChatWidgetWrapper />

              <Toaster
                position="top-right"
                expand={false}
                richColors
                closeButton
                theme="system"
                toastOptions={{
                  style: {
                    background: "rgba(15, 23, 42, 0.95)",
                    backdropFilter: "blur(16px)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#e2e8f0",
                    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
                  },
                  className: "group",
                  duration: 4000,
                }}
              />
            </ChatProvider>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}