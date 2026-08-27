import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { createWidgetScript } from "./widget-script";

describe("widget script", () => {
  it("generates standalone valid browser JavaScript", () => {
    const script = createWidgetScript("https://aurbit.takshil.in");

    expect(() => new Script(script)).not.toThrow();
    expect(script).toContain('"https://aurbit.takshil.in"');
    expect(script).not.toContain("React");
  });

  it("normalizes the report origin and rejects non-web protocols", () => {
    const script = createWidgetScript(
      "https://aurbit.takshil.in/some/request/path",
    );

    expect(script).toContain('"https://aurbit.takshil.in"');
    expect(script).not.toContain("/some/request/path");
    expect(() => createWidgetScript("javascript:alert(1)")).toThrow(TypeError);
  });

  it("contains the public-key validation and controlled report path", () => {
    const script = createWidgetScript("https://aurbit.takshil.in");

    expect(script).toContain("^pk_proj_[a-f0-9]{24}$");
    expect(script).toContain('"/report/" + encodeURIComponent(projectKey)');
    expect(script).toContain('searchParams.set("source"');
    expect(script).toContain('sourcePageUrl.username = ""');
    expect(script).toContain('sourcePageUrl.password = ""');
    expect(script).toContain('sourcePageUrl.search = ""');
    expect(script).toContain('sourcePageUrl.hash = ""');
    expect(script).not.toContain("data-url");
    expect(script).not.toContain("data-origin");
  });

  it("uses Shadow DOM and guards against duplicate initialization", () => {
    const script = createWidgetScript("https://aurbit.takshil.in");

    expect(script).toContain('attachShadow({ mode: "closed" })');
    expect(script).toContain('Symbol.for("aurbit.widget.initialized")');
  });

  it("stays lightweight", () => {
    const script = createWidgetScript("https://aurbit.takshil.in");

    expect(new TextEncoder().encode(script).byteLength).toBeLessThan(15_000);
  });
});
