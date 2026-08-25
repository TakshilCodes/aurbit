import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@aurbit/db";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google, { type GoogleProfile } from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import Resend from "next-auth/providers/resend";
import { authCapabilities, optionalAuthEnvironment } from "./lib/environment";
import { INVALID_PASSWORD_HASH, verifyPassword } from "./lib/password";
import { loginSchema } from "./lib/validation";

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);

      if (!parsed.success) {
        return null;
      }

      const user = await db.user.findUnique({
        where: { email: parsed.data.email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          passwordHash: true,
        },
      });
      const passwordMatches = await verifyPassword(
        parsed.data.password,
        String(user?.passwordHash ?? INVALID_PASSWORD_HASH),
      );

      if (!user?.passwordHash || !user.emailVerified || !passwordMatches) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: String(user.image),
      };
    },
  }),
];

if (
  authCapabilities.google &&
  optionalAuthEnvironment.googleId &&
  optionalAuthEnvironment.googleSecret
) {
  providers.push(
    Google({
      clientId: optionalAuthEnvironment.googleId,
      clientSecret: optionalAuthEnvironment.googleSecret,
      allowDangerousEmailAccountLinking: true,
      profile(profile: GoogleProfile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
        };
      },
    }),
  );
}

if (
  authCapabilities.email &&
  optionalAuthEnvironment.resendKey &&
  optionalAuthEnvironment.emailFrom
) {
  providers.push(
    Resend({
      apiKey: optionalAuthEnvironment.resendKey,
      from: optionalAuthEnvironment.emailFrom,
      maxAge: 15 * 60,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  pages: {
    error: "/auth-error",
    signIn: "/login",
    verifyRequest: "/check-email",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers,
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === "google") {
        return Boolean((profile as GoogleProfile | undefined)?.email_verified);
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        const persistedUser = await db.user.findUnique({
          where: { id: user.id },
          select: { sessionVersion: true },
        });
        token.sessionVersion = persistedUser?.sessionVersion ?? -1;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : -1;
      }

      return session;
    },
  },
});
