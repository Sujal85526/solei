/**
 * Help topic body → blocks. The format is deliberately tiny so the owner can edit it safely:
 *   "## Heading" · "1. item" (numbered list) · blank line = new paragraph · [to confirm]
 * Text is never parsed as HTML; `[…]` segments are returned separately to render as markers.
 */
export type HelpBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

export function parseHelpBody(body: string): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", text: para.join(" ") });
    para = [];
    if (list) blocks.push({ type: "list", items: list });
    list = null;
  };
  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1].trim() });
      continue;
    }
    const item = line.match(/^\d+[.)]\s+(.+)$/);
    if (item) {
      if (para.length) {
        blocks.push({ type: "paragraph", text: para.join(" ") });
        para = [];
      }
      (list ??= []).push(item[1].trim());
      continue;
    }
    if (list) flush();
    para.push(line);
  }
  flush();
  return blocks;
}

/** Splits text into plain parts and `[to confirm]` markers. */
export function splitMarkers(text: string): { text: string; marker: boolean }[] {
  return text
    .split(/(\[[^\]\n]+\])/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("[") && part.endsWith("]")
        ? { text: part.slice(1, -1), marker: true }
        : { text: part, marker: false },
    );
}

/**
 * One-line returns summary for the checkout screen, taken from the owner-edited returns topic:
 * the text under a "## At checkout" (or "## In short" / "## Summary") heading when there is one,
 * else the first sentence of the first section. `[to confirm]` notes are dropped. Null if empty.
 */
export function policySummary(body: string): string | null {
  const blocks = parseHelpBody(body);
  const text = (b: HelpBlock) => (b.type === "paragraph" ? b.text : "");
  const at = blocks.findIndex(
    (b) => b.type === "heading" && /^(at checkout|in short|summary)$/i.test(b.text),
  );
  let summary = "";
  if (at >= 0) {
    const end = blocks.findIndex((b, i) => i > at && b.type === "heading");
    summary = blocks
      .slice(at + 1, end < 0 ? undefined : end)
      .map(text)
      .filter(Boolean)
      .join(" ");
  } else {
    const first = blocks.findIndex((b) => b.type === "heading");
    const para = blocks.slice(first + 1).find((b) => b.type === "paragraph");
    summary = para ? (text(para).match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text(para)) : "";
  }
  summary = summary
    .replace(/\[[^\]\n]*\]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
  return summary || null;
}
