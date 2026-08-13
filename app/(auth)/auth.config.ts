import type { NextAuthConfig } from "next-auth";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const authConfig = {
  basePath: "/api/auth",
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      if (pathname === "/api/metrics") {
        return true;
      }

      if (pathname === "/api/auth/guest") {
        return true;
      }

      // Protected routes: all routes except /login and /register
      return !!auth;
    },
  },
  pages: {
    newUser: `${base}/`,
    signIn: `${base}/login`,
  },
  providers: [
    // GitHub OAuth will be added in auth.ts via provider config
  ],
  trustHost: true,
} satisfies NextAuthConfig;
