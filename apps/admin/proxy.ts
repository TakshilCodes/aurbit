import { NextResponse } from "next/server";
import { auth } from "./auth";

export default auth((request) => {
  if (!request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|login|signup|invite|verify-email|forgot-password|reset-password|check-email|auth-error|_next/static|_next/image|icons/|favicon.ico).*)",
  ],
};
