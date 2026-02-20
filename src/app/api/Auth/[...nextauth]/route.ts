// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ✅ Prisma singleton (dev-safe)
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function normalizeEmail(raw: string) {
  return (raw || "").trim().toLowerCase();
}

function normalizePhoneToLocalDigits(raw: string) {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("62")) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  return digits;
}

function buildPhoneCandidates(rawPhone: string) {
  const d = normalizePhoneToLocalDigits(rawPhone);
  if (!d) return [];
  return [`0${d}`, d, `62${d}`, `+62${d}`];
}

function looksLikePhone(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        try {
          const password = credentials?.password;
          if (!password) throw new Error("Password wajib diisi.");

          const emailRaw = String(credentials?.email || "");
          const phoneRaw = String(credentials?.phone || "");

          const email = normalizeEmail(emailRaw);

          // kalau user isi email dengan angka, treat as phone
          const mergedPhoneRaw =
            phoneRaw?.trim() || (looksLikePhone(emailRaw) ? emailRaw.trim() : "");

          const phoneCandidates = buildPhoneCandidates(mergedPhoneRaw);

          if (!email && phoneCandidates.length === 0) {
            throw new Error("Email atau No. HP wajib diisi.");
          }

          const OR: any[] = [];

          // kalau email field berisi phone, jangan treat sebagai email
          if (email && !looksLikePhone(emailRaw)) {
            OR.push({ email: { equals: email, mode: "insensitive" } });
          }

          if (phoneCandidates.length) {
            OR.push(...phoneCandidates.map((p) => ({ nomor_telepon: p })));
          }

          if (OR.length === 0) throw new Error("Email atau No. HP wajib diisi.");

          const user = await prisma.pengguna.findFirst({
            where: { OR },
            select: {
              id_pengguna: true,
              nama_lengkap: true,
              email: true,
              nomor_telepon: true,
              kata_sandi: true,
              peran: true,
              status_akun: true,
              google_id: true,
            },
          });

          if (!user) throw new Error("Akun tidak ditemukan.");

          if (!user.kata_sandi) {
            throw new Error(
              "Akun terdaftar via Google. Silakan login dengan tombol Google."
            );
          }

          // guard bcrypt hash
          if (typeof user.kata_sandi === "string" && !user.kata_sandi.startsWith("$2")) {
            throw new Error(
              "Password di database belum bcrypt. Silakan reset password / migrasi hash."
            );
          }

          const ok = await bcrypt.compare(password, user.kata_sandi);
          if (!ok) throw new Error("Kata sandi salah.");

          return {
            id: user.id_pengguna,
            name: user.nama_lengkap,
            email: user.email,
            image: null, // ✅ aman (karena field foto_profil_url tidak ada di schema)
            role: user.peran,
          } as any;
        } catch (err) {
          console.error("❌ AUTHORIZE ERROR:", err);
          throw err;
        }
      },
    }),
  ],

  pages: {
    signIn: "/signin",
    error: "/signin",
  },

  session: { strategy: "jwt" },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async signIn({ account, profile }: any) {
      if (account?.provider !== "google") return true;

      try {
        const email = normalizeEmail(profile?.email || "");
        if (!email) throw new Error("Google tidak memberikan email.");

        const providerAccountId = account.providerAccountId;

        const existingUser = await prisma.pengguna.findFirst({
          where: {
            OR: [
              { google_id: providerAccountId },
              { email: { equals: email, mode: "insensitive" } },
            ],
          },
          select: { id_pengguna: true, google_id: true },
        });

        if (!existingUser) {
          await prisma.pengguna.create({
            data: {
              nama_lengkap: profile?.name || "Pengguna Google",
              email,
              google_id: providerAccountId,
              kata_sandi: null,
              peran: "USER",
              status_akun: "AKTIF",
              wa_terverifikasi: true,
              // ⚠️ kalau kamu punya field foto, isi di sini setelah kamu kasih nama fieldnya
              // contoh: foto_profil: profile?.picture,
            },
          });
        } else if (!existingUser.google_id) {
          await prisma.pengguna.update({
            where: { id_pengguna: existingUser.id_pengguna },
            data: {
              google_id: providerAccountId,
              // ⚠️ kalau kamu punya field foto, update di sini
              // contoh: foto_profil: profile?.picture,
            },
          });
        }

        return true;
      } catch (error) {
        console.error("❌ Google signIn error:", error);
        return false;
      }
    },

    async jwt({ token, user, account }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        if (user.email) token.email = user.email;
      }

      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.pengguna.findFirst({
          where: { email: { equals: String(token.email), mode: "insensitive" } },
          select: { id_pengguna: true, peran: true, email: true },
        });

        if (dbUser) {
          token.id = dbUser.id_pengguna;
          token.role = dbUser.peran;
          token.email = dbUser.email || token.email;
        }
      }

      // lookup agentId
      if (token.id) {
        const agent = await prisma.agent.findFirst({
          where: { id_pengguna: String(token.id) },
          select: { id_agent: true },
        });
        token.agentId = agent?.id_agent || null;
      } else {
        token.agentId = null;
      }

      return token;
    },

    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.agentId = token.agentId;
      }
      return session;
    },
  },

  events: {
    async error(message) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ NextAuth event error:", message);
      }
    },
  },

  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
