import {
  NextResponse,
  NextRequest,
  type NextFetchEvent,
  type NextMiddleware,
} from "next/server";
import type { NextAuthRequest } from "next-auth";
import { createRequestContext } from "@aurbit/logger/request";
import { auth } from "./auth";

const authorize: (
  request: NextAuthRequest,
  event: NextFetchEvent,
) => ReturnType<NextMiddleware> = (request) => {
  if (!request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next({ request: { headers: request.headers } });
};
const protectedProxy = auth(authorize);

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const { headers, requestId } = createRequestContext(request.headers);
  // Preserve the existing public-path exclusions without authenticating them.
  const publicPath =
    /^\/(api\/auth|login|signup|invite|verify-email|forgot-password|reset-password|check-email|auth-error)/.test(
      request.nextUrl.pathname,
    );
  const response = publicPath
    ? NextResponse.next({ request: { headers } })
    : await protectedProxy(new NextRequest(request, { headers }), event);
  if (response) response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|favicon.ico).*)"],
};
