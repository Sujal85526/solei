import { describe, expect, it } from "vitest";
import { interpolate, markdownToHtml, renderTemplate } from "./render";

describe("notification rendering", () => {
  it("interpolates variables and blanks unknown ones", () => {
    expect(interpolate("Hi {{name}}{{missing}}!", { name: "Layla" })).toBe("Hi Layla!");
  });

  it("escapes HTML from variables and the body", () => {
    const r = renderTemplate(
      { subject: "Order {{n}}", body: "Dear {{name}}" },
      { n: "SOL-1", name: "<script>x</script>" },
    );
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).not.toContain("<script>");
  });

  it("supports bold, safe links and paragraphs", () => {
    const html = markdownToHtml(
      "**Hi**\n\n[Track](https://solei.ae/track?a=1&b=2) and [bad](javascript:alert(1))",
    );
    expect(html).toContain("<strong>Hi</strong>");
    expect(html).toContain('href="https://solei.ae/track?a=1&amp;b=2"');
    expect(html).not.toContain("javascript:");
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("produces a plain-text alternative", () => {
    const r = renderTemplate(
      { subject: "S", body: "**Total: {{t}}**\n\n[Open]({{u}})" },
      { t: "AED 280", u: "https://x.y/z" },
    );
    expect(r.text).toBe("Total: AED 280\n\nOpen (https://x.y/z)");
  });
});
