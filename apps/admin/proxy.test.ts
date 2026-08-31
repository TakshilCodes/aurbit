import { beforeEach, expect, it, vi } from "vitest";
import {
  NextRequest,
  type NextFetchEvent,
  type NextMiddleware,
} from "next/server";
import type { NextAuthRequest, Session } from "next-auth";
import proxy from "./proxy";
const mocks = vi.hoisted(() => ({
  session: null as Session | null,
  authenticated: vi.fn(),
}));
vi.mock("./auth", () => ({
  auth:
    (
      handler: (
        request: NextAuthRequest,
        event: NextFetchEvent,
      ) => ReturnType<NextMiddleware>,
    ) =>
    (request: NextRequest, event: NextFetchEvent) => {
      mocks.authenticated();
      return handler(Object.assign(request, { auth: mocks.session }), event);
    },
}));
const event = {} as NextFetchEvent;
beforeEach(() => {
  mocks.session = null;
  vi.clearAllMocks();
});

it("adds correlation on public auth/invite paths without invoking authentication", async () => {
  for (const path of [
    "/login",
    "/signup",
    "/invite?token=secret",
    "/api/auth/callback/google",
  ]) {
    const request = new NextRequest("https://admin.example" + path, {
      headers: { "x-request-id": "forged" },
    });
    const response = await proxy(request, event);
    expect(response?.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
    expect(response?.headers.get("x-middleware-request-x-request-id")).toBe(
      response?.headers.get("x-request-id"),
    );
  }
  expect(mocks.authenticated).not.toHaveBeenCalled();
});

it("preserves the signed-out redirect for protected workspace routes", async () => {
  const response = await proxy(
    new NextRequest("https://admin.example/organizations/workspace/reports"),
    event,
  );
  expect(response?.status).toBe(307);
  expect(new URL(response?.headers.get("location") ?? "").pathname).toBe(
    "/login",
  );
  expect(response?.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
  expect(mocks.authenticated).toHaveBeenCalledOnce();
});

it("preserves authenticated access and forwards the generated ID", async () => {
  mocks.session = {
    user: { id: "user_1", sessionVersion: 0 },
    expires: "2030-01-01",
  };
  const response = await proxy(
    new NextRequest("https://admin.example/organizations/workspace/reports"),
    event,
  );
  expect(response?.status).toBe(200);
  expect(response?.headers.get("x-middleware-request-x-request-id")).toBe(
    response?.headers.get("x-request-id"),
  );
});
