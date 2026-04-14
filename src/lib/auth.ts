import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

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

          if (user.status_akun && user.status_akun !== "AKTIF") {
            throw new Error("Akun kamu sedang tidak aktif. Hubungi admin.");
          }

          if (!user.kata_sandi) {
            throw new Error(
              "Akun terdaftar via Google. Silakan login dengan tombol Google."
            );
          }

          // guard bcrypt hash
          if (
            typeof user.kata_sandi === "string" &&
            !user.kata_sandi.startsWith("$2")
          ) {
            throw new Error(
              "Password di database belum bcrypt. Silakan reset password / migrasi hash."
            );
          }

          const ok = await bcrypt.compare(password, user.kata_sandi);
          if (!ok) throw new Error("Kata sandi salah.");

          // ✅ Kembalikan minimal payload yang dibutuhkan JWT
          return {
            id: user.id_pengguna,
            name: user.nama_lengkap,
            email: user.email,
            image: null,
          } as any;
        } catch (err) {
          console.error("❌ AUTHORIZE ERROR:", err);
          throw err;
        }
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/",
    error: "/",
  },

  callbacks: {
    /**
     * ✅ signIn: di-trigger saat user login (credentials atau google)
     */
    async signIn({ user, account, profile }: any) {
      try {
        // Buat user.id jika belum ada (kadang google cuma punya email)
        if (!user.id) user.id = profile?.sub || user.email || "";

        if (account?.provider === "google") {
          // Cari user by email
          const existingUser = await prisma.pengguna.findFirst({
            where: {
              email: { equals: user.email, mode: "insensitive" },
            },
            select: { id_pengguna: true },
          });

          // Kalau user baru, buat
          if (!existingUser) {
            await prisma.pengguna.create({
              data: {
                id_pengguna: user.id,
                nama_lengkap: user.name || user.email || "Unknown",
                email: user.email,
                google_id: profile?.sub,
                peran: "USER",
                status_akun: "AKTIF",
              },
            });
          } else {
            // Update google_id
            user.id = existingUser.id_pengguna;
            await prisma.pengguna.update({
              where: { id_pengguna: existingUser.id_pengguna },
              data: { google_id: profile?.sub },
            });
          }
        }

        return true;
      } catch (error) {
        console.error("❌ Google signIn error:", error);
        return false;
      }
    },

    /**
     * ✅ JWT: SINGLE SOURCE OF TRUTH dari DB
     * Ini yang bikin suspend/aktif langsung ngaruh ke header + middleware.
     */
    async jwt({ token, user, account }: any) {
      // 1) Saat login pertama (credentials / google), set identitas awal
      if (user?.id) token.id = user.id;
      if (user?.email) token.email = user.email;

      // 2) Pastikan token.id ada untuk google (kadang cuma email)
      //    -> cari user by email kalau belum kebentuk id
      if (!token.id && token.email) {
        const db = await prisma.pengguna.findFirst({
          where: { email: { equals: String(token.email), mode: "insensitive" } },
          select: { id_pengguna: true },
        });
        if (db) token.id = db.id_pengguna;
      }

      // 3) Kalau sudah ada id, selalu refresh peran + agentId dari DB (setiap request)
      if (token.id) {
        const dbUser = await prisma.pengguna.findUnique({
          where: { id_pengguna: String(token.id) },
          select: {
            id_pengguna: true,
            nama_lengkap: true,
            email: true,
            peran: true,
            status_akun: true,
            agent: { select: { id_agent: true, status_keanggotaan: true } },
          },
        });

        if (dbUser) {
          token.id = dbUser.id_pengguna;
          token.name = dbUser.nama_lengkap || token.name;
          token.email = dbUser.email || token.email;

          // ✅ pakai peran sebagai patokan utama
          token.peran = dbUser.peran;

          // kompatibilitas dengan kode lama yang masih baca token.role
          token.role = dbUser.peran;

          // agent id (boleh null)
          token.agentId = dbUser.agent?.id_agent ?? null;

          // optional: bisa dipakai UI
          token.agentStatus = dbUser.agent?.status_keanggotaan ?? null;
          token.status_akun = dbUser.status_akun ?? null;
        } else {
          // user hilang dari DB
          token.peran = "USER";
          token.role = "USER";
          token.agentId = null;
          token.agentStatus = null;
        }
      } else {
        token.peran = token.peran ?? token.role ?? "USER";
        token.role = token.role ?? token.peran ?? "USER";
        token.agentId = token.agentId ?? null;
        token.agentStatus = token.agentStatus ?? null;
      }

      return token;
    },

    /**
     * ✅ Session: expose fields ke client
     * Mulai sekarang pakai session.user.peran di FE.
     */
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = session.user.name ?? token.name ?? null;
        session.user.email = session.user.email ?? token.email ?? null;

        // ✅ field utama
        session.user.peran = token.peran ?? token.role ?? "USER";

        // ✅ kompatibilitas lama
        session.user.role = token.role ?? token.peran ?? "USER";

        session.user.agentId = token.agentId ?? null;

        // optional untuk UI
        session.user.agentStatus = token.agentStatus ?? null;
        session.user.status_akun = token.status_akun ?? null;
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
