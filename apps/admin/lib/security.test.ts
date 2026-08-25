import { describe, expect, it } from "vitest";
import {
  generateOrganizationSlug,
  generatePublicProjectKey,
  generateSecureToken,
  hashToken,
} from "./tokens";
import {
  emailSchemaInput,
  loginSchema,
  resetPasswordSchema,
  safeRedirectPath,
  signupSchema,
} from "./validation";

describe("authentication input validation", () => {
  it("returns clear field messages for missing and invalid signup input", () => {
    const result = signupSchema.safeParse({
      name: "",
      email: "not-an-email",
      password: "short",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        name: ["Name is required."],
        email: ["Enter a valid email address."],
        password: ["Password must be at least 8 characters."],
        confirmPassword: ["Passwords do not match."],
      });
    }
  });

  it("turns a missing form email into a useful required message", () => {
    const result = emailSchemaInput.safeParse({ email: null });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toEqual([
        "Email is required.",
      ]);
    }
  });
  it("normalizes email addresses", () => {
    const result = loginSchema.parse({
      email: "  PERSON@EXAMPLE.COM ",
      password: "valid-password",
    });

    expect(result.email).toBe("person@example.com");
  });

  it("accepts an eight-character password and rejects shorter passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "short-7",
        confirmPassword: "short-7",
        token: "a".repeat(64),
      }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        password: "blue fox",
        confirmPassword: "blue fox",
        token: "a".repeat(64),
      }).success,
    ).toBe(true);
  });

  it.each(["password", "Password123", "AURBIT123"])(
    "rejects a commonly guessed password: %s",
    (password) => {
      expect(
        resetPasswordSchema.safeParse({
          password,
          confirmPassword: password,
          token: "a".repeat(64),
        }).success,
      ).toBe(false);
    },
  );

  it("rejects passwords that exceed bcrypt's 72-byte input limit", () => {
    const password = "🔒".repeat(19);

    expect(
      resetPasswordSchema.safeParse({
        password,
        confirmPassword: password,
        token: "a".repeat(64),
      }).success,
    ).toBe(false);
  });

  it.each(["https://evil.example", "//evil.example", "login", ""])(
    "rejects an unsafe redirect target: %s",
    (target) => {
      expect(safeRedirectPath(target)).toBe("/");
    },
  );

  it("keeps safe local redirect paths", () => {
    expect(safeRedirectPath("/organizations/org_1/projects")).toBe(
      "/organizations/org_1/projects",
    );
  });
});

describe("security token generation", () => {
  it("generates distinct project keys with the public prefix", () => {
    const first = generatePublicProjectKey();
    const second = generatePublicProjectKey();

    expect(first).toMatch(/^pk_proj_[a-f0-9]{24}$/);
    expect(second).not.toBe(first);
  });

  it("generates non-guessable tokens and hashes them deterministically", async () => {
    const token = generateSecureToken();

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashToken(token)).toBe(await hashToken(token));
    expect(await hashToken(generateSecureToken())).not.toBe(
      await hashToken(token),
    );
  });

  it("creates readable slugs with a uniqueness suffix", () => {
    const slug = generateOrganizationSlug("Aurbit Demo Team");

    expect(slug).toMatch(/^aurbit-demo-team-[a-f0-9]{8}$/);
  });
});
