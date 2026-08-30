import { describe, expect, it } from "vitest";
import { createReportCreatedEmail } from "./report-created-email";

describe("report-created email", () => {
  it("renders safe branded HTML and a plain-text fallback", () => {
    const content = createReportCreatedEmail({
      createdAt: "Aug 30, 2026, 10:30 AM",
      logoUrl: "https://admin.aurbit.test/brand/aurbit-wordmark.png",
      projectName: "Dashboard <Production>",
      reporterEmail: null,
      reportTitle: "Broken <script>alert(1)</script>",
      reportUrl: "https://admin.aurbit.test/organizations/org/reports/report",
      workspaceName: "Acme & Co",
    });

    expect(content.subject).toContain("New bug report in Dashboard");
    expect(content.html).toContain("Aurbit · Bug reporting for product teams");
    expect(content.html).toContain("Anonymous");
    expect(content.html).toContain("Broken &lt;script&gt;");
    expect(content.html).not.toContain("<script>alert(1)</script>");
    expect(content.text).toContain("View report:");
    expect(content.text).toContain("https://admin.aurbit.test/organizations/");
  });
});
