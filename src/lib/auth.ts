import bcrypt from "bcryptjs";
import { AuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { ensureSystemAdminUser } from "@/lib/admin";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authOptions: AuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers: [
    CredentialsProvider({
      name: "SoulSync Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) {
          return null;
        }

        await connectDB();
        await ensureSystemAdminUser();
        const user = await User.findOne({ email: parsed.data.email.toLowerCase() });

        if (!user) {
          return null;
        }

        if (user.isBlocked) {
          return null;
        }

        const validPassword = await bcrypt.compare(parsed.data.password, user.password);
        if (!validPassword) {
          return null;
        }

        return {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          role: user.role ?? "user",
          isBlocked: Boolean(user.isBlocked),
          postRestrictionUntil: user.postRestrictionUntil ? user.postRestrictionUntil.toISOString() : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.avatar = user.avatar;
        token.role = user.role ?? "user";
        token.isBlocked = user.isBlocked ?? false;
        token.postRestrictionUntil = user.postRestrictionUntil ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.avatar = token.avatar;
        session.user.role = token.role ?? "user";
        session.user.isBlocked = Boolean(token.isBlocked ?? false);
        session.user.postRestrictionUntil = token.postRestrictionUntil ?? null;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
