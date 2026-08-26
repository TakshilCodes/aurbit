import { describe, expect, it } from "vitest";
import { createVerificationEmail } from "./verification-email";

describe("verification email template", () => {
  it("includes a branded CTA, expiry copy, and plain URL fallback", () => {
    const verificationUrl =
      "https://admin.aurbit.takshil.in/verify-email?token=abc123";
    const logoUrl = "https://admin.aurbit.takshil.in/brand/aurbit-wordmark.png";
    const content = createVerificationEmail({ logoUrl, verificationUrl });

    expect(content.html).toContain('src="' + logoUrl + '"');
    expect(content.html).toContain('href="' + verificationUrl + '"');
    expect(content.html).toContain(">Verify email</a>");
    expect(content.html).toContain("This link expires in 1 hour.");
    expect(content.html).toContain(verificationUrl);
    expect(content.text).toContain(verificationUrl);
    expect(content.text).toContain("This link expires in 1 hour.");
  });

  it("escapes URLs before inserting them into HTML", () => {
    const content = createVerificationEmail({
      logoUrl: "https://example.com/logo.png?size=large&theme=dark",
      verificationUrl: "https://example.com/verify?token=abc&next=/",
    });

    expect(content.html).toContain(
      "https://example.com/verify?token=abc&amp;next=/",
    );
    expect(content.html).toContain(
      "https://example.com/logo.png?size=large&amp;theme=dark",
    );
  });
});
