// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Protect dashboard
  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // belum login
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("auth", "required");
      return NextResponse.redirect(url);
    }

    // bukan agent
    const role = (token as any).peran || (token as any).role;
    if (role !== "AGENT") {
      const url = req.nextUrl.clone();
      url.pathname = "/gabung-jadi-agent";
      url.searchParams.set("reason", "not-agent");
      return NextResponse.redirect(url);
    }

    // ✅ Halaman Agents (HRM) hanya untuk PRINCIPAL & OWNER
    if (pathname.startsWith("/dashboard/human-resource-management")) {
      const jabatan = String((token as any).jabatan || "").toUpperCase();
      if (jabatan !== "PRINCIPAL" && jabatan !== "OWNER") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.searchParams.set("reason", "forbidden");
        return NextResponse.redirect(url);
      }
    }

    // ✅ Kelola Berita hanya untuk OWNER, ADMIN & PRINCIPAL
    if (pathname.startsWith("/dashboard/berita")) {
      const jabatan = String((token as any).jabatan || "").toUpperCase();
      if (!["OWNER", "ADMIN", "PRINCIPAL"].includes(jabatan)) {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        url.searchParams.set("reason", "forbidden");
        return NextResponse.redirect(url);
      }
    }
  }

  // ✅ Optional: larang agent buka gabung-jadi-agent
  if (pathname.startsWith("/gabung-jadi-agent")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      const role = (token as any).peran || (token as any).role;
      if (role === "AGENT") {
        const url = req.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/gabung-jadi-agent"],
};
