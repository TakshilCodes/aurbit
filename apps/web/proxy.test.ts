import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

it("returns and forwards the same fresh request ID for hosted reports and API requests", () => {
  for (const path of [
    "/report/pk_proj_test",
    "/api/public/projects/pk_proj_test",
  ]) {
    const incoming = crypto.randomUUID();
    const response = proxy(
      new NextRequest("https://aurbit.example" + path, {
        headers: { "x-request-id": incoming },
      }),
    );
    const id = response.headers.get("x-request-id");
    expect(id).not.toBe(incoming);
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers.get("x-middleware-request-x-request-id")).toBe(id);
  }
});
