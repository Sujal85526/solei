import { describe, expect, it } from "vitest";
import { parseHelpBody, splitMarkers } from "./format";

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
