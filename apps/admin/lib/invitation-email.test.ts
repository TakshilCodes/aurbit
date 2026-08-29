import { describe, expect, it } from "vitest";
import { createWorkspaceInvitationEmail } from "./invitation-email";

describe("workspace invitation email", () => {
  it("renders branded invitation details, CTA, expiry, and URL fallback", () => {
    const invitationUrl = "https://admin.aurbit.takshil.in/invite?token=abc123";
    const content = createWorkspaceInvitationEmail({
      expiryDate: "September 5, 2026",
      invitationUrl,
      inviterName: "Takshil",
      logoUrl: "https://admin.aurbit.takshil.in/brand/aurbit-wordmark.png",
      role: "Admin",
      workspaceName: "Aurbit Labs",
    });
    expect(content.subject).toBe(
      "Takshil invited you to Aurbit Labs on Aurbit",
    );
    expect(content.html).toContain("You've been invited to a workspace");
    expect(content.html).toContain(">Accept invitation</a>");
    expect(content.html).toContain(invitationUrl);
    expect(content.html).toContain("September 5, 2026");
    expect(content.text).toContain(invitationUrl);
    expect(content.text).toContain("Bug reporting for product teams");
  });

  it("escapes every untrusted value inserted into HTML", () => {
    const content = createWorkspaceInvitationEmail({
      expiryDate: "September 5 & later",
      invitationUrl: "https://example.com/invite?token=abc&next=/",
      inviterName: "<Owner>",
      logoUrl: "https://example.com/logo.png?theme=dark&size=large",
      role: "Member",
      workspaceName: "A&B <script>",
    });
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("A&amp;B &lt;script&gt;");
    expect(content.html).toContain("&lt;Owner&gt;");
    expect(content.html).toContain("token=abc&amp;next=/");
  });
});
