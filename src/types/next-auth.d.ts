import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    forcePasswordReset: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      forcePasswordReset: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    forcePasswordReset: boolean;
  }
}
