import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      peran?: string;
      role?: string;
      agentId?: string | null;
      agentStatus?: string | null;
      status_akun?: string | null;
    };
  }

  interface User {
    id: string;
    peran?: string;
    role?: string;
    agentId?: string | null;
    agentStatus?: string | null;
    status_akun?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    peran?: string;
    role?: string;
    agentId?: string | null;
    agentStatus?: string | null;
    status_akun?: string | null;
  }
}
