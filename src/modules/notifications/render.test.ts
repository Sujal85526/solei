import { describe, expect, it } from "vitest";
import { interpolate, markdownToHtml, renderTemplate, templateVariables } from "./render";

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

  it("never parses variables as markdown, but resolves link targets", () => {
    const r = renderTemplate(
      { subject: "S", body: "Dear {{name}}\n\n[Track]({{link}})\n\n{{lines}}" },
      {
        name: "[win](https://evil.example) **bold**",
        link: "https://solei.ae/order/SOL-1?t=a&b",
        lines: "1 × Capri\n2 × Soho",
      },
    );
    expect(r.html).not.toContain('evil.example"');
    expect(r.html).not.toContain("<strong>bold</strong>");
    expect(r.html).toContain("[win](https://evil.example) **bold**");
    expect(r.html).toContain('href="https://solei.ae/order/SOL-1?t=a&amp;b"');
    expect(r.html).toContain("1 × Capri<br>2 × Soho");
  });

  it("drops a link whose variable isn't a safe URL", () => {
    const html = markdownToHtml("[Open]({{u}})", { u: "javascript:alert(1)" });
    expect(html).not.toContain("href");
    expect(html).toContain("Open");
  });

  it("lists the variables a template uses", () => {
    expect(templateVariables("{{a}} {{ b }} {{a}}")).toEqual(["a", "b"]);
  });

  it("produces a plain-text alternative", () => {
    const r = renderTemplate(
      { subject: "S", body: "**Total: {{t}}**\n\n[Open]({{u}})" },
      { t: "AED 280", u: "https://x.y/z" },
    );
    expect(r.text).toBe("Total: AED 280\n\nOpen (https://x.y/z)");
  });
});
