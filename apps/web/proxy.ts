import { createRequestContext } from "@aurbit/logger/request";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { headers, requestId } = createRequestContext(request.headers);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
