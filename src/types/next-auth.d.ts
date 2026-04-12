import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      avatar?: string;
      role: "user" | "admin";
      isBlocked: boolean;
      postRestrictionUntil?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: "user" | "admin";
    isBlocked: boolean;
    postRestrictionUntil?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role: "user" | "admin";
    isBlocked: boolean;
    postRestrictionUntil?: string | null;
  }
}
