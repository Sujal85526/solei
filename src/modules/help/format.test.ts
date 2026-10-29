import { describe, expect, it } from "vitest";
import { parseHelpBody, policySummary, splitMarkers } from "./format";

describe("parseHelpBody", () => {
  it("reads headings, paragraphs and numbered lists", () => {
    const body = "Intro line one\nline two.\n\n## Heading\nPara.\n\n1. First\n2. Second\nAfter.";
    expect(parseHelpBody(body)).toEqual([
      { type: "paragraph", text: "Intro line one line two." },
      { type: "heading", text: "Heading" },
      { type: "paragraph", text: "Para." },
      { type: "list", items: ["First", "Second"] },
      { type: "paragraph", text: "After." },
    ]);
  });

  it("never treats text as HTML", () => {
    expect(parseHelpBody("<script>x</script>")).toEqual([
      { type: "paragraph", text: "<script>x</script>" },
    ]);
  });
});

describe("splitMarkers", () => {
  it("separates [to confirm] markers", () => {
    expect(splitMarkers("Within [CONFIRM WINDOW] days.")).toEqual([
      { text: "Within ", marker: false },
      { text: "CONFIRM WINDOW", marker: true },
      { text: " days.", marker: false },
    ]);
  });
});

describe("policySummary", () => {
  it("takes the first sentence of the first section", () => {
    const body =
      "Intro.\n\n## Change-of-mind requests\nWe accept returns within seven (7) days for unopened items. More detail.\n\n## Other\nX.";
    expect(policySummary(body)).toBe("We accept returns within seven (7) days for unopened items.");
  });

  it('prefers an "At checkout" section and drops [to confirm] notes', () => {
    const body =
      "## Returns\nLong text.\n\n## At checkout\nReturns within 7 days [CONFIRM].\nRefunds to your card.\n\n## Next\nY.";
    expect(policySummary(body)).toBe("Returns within 7 days. Refunds to your card.");
  });

  it("is null for an empty topic", () => {
    expect(policySummary("")).toBeNull();
    expect(policySummary("## Only a heading")).toBeNull();
  });
});
