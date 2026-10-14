/**
 * Template rendering for owner-editable notifications.
 * Body syntax (kept deliberately small so the owner can edit safely):
 *   {{variable}}  · **bold**  · [label](https://link)  · blank line = new paragraph
 * Variables are HTML-escaped and never parsed as markdown (a customer name can't become a link);
 * unknown variables render empty.
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

const VAR = /\{\{\s*([a-z_]+)\s*\}\}/g;
const value = (vars: TemplateVars, key: string) => {
  const v = vars[key];
  return v === null || v === undefined ? "" : String(v);
};

export function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(VAR, (_, key: string) => value(vars, key));
}

/** Variable names used in a template (for the editor's "unknown variable" hint). */
export function templateVariables(template: string): string[] {
  return [...new Set([...template.matchAll(VAR)].map((m) => m[1]))];
}

function safeUrl(url: string): string | null {
  return /^(https?:\/\/|\/)/.test(url) ? url : null;
}

// Placeholders survive escaping and markdown untouched (no &<>"'*[]() characters).
const SLOT = (i: number) => `\uE000${i}\uE000`;
const SLOT_RE = /\uE000(\d+)\uE000/g;

/**
 * Light markdown → HTML. The template is escaped first, so only our own tags are produced;
 * variable values are inserted afterwards as escaped text (or, inside a link target, as a URL).
 */
export function markdownToHtml(md: string, vars: TemplateVars = {}): string {
  const values: string[] = [];
  const slotted = md.replace(VAR, (_, key: string) => {
    values.push(value(vars, key));
    return SLOT(values.length - 1);
  });
  const fillText = (s: string) =>
    s.replace(SLOT_RE, (_, i: string) => escapeHtml(values[Number(i)]).replace(/\n/g, "<br>"));
  const fillUrl = (s: string) => s.replace(SLOT_RE, (_, i: string) => values[Number(i)].trim());

  return slotted
    .trim()
    .split(/\n{2,}/)
    .map((para) => {
      let html = escapeHtml(para);
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
        const href = safeUrl(fillUrl(url).replace(/&amp;/g, "&"));
        return href
          ? `<a href="${escapeHtml(href)}" style="color:#460328;text-decoration:underline">${label}</a>`
          : label;
      });
      html = html.replace(/\n/g, "<br>");
      return `<p style="margin:0 0 16px">${fillText(html)}</p>`;
    })
    .filter((p) => p !== '<p style="margin:0 0 16px"></p>')
    .join("\n");
}

export function markdownToText(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderTemplate(
  t: { subject: string; body: string },
  vars: TemplateVars,
): { subject: string; html: string; text: string } {
  const subject = interpolate(t.subject, vars).replace(/\s+/g, " ").trim();
  return {
    subject,
    html: emailLayout(markdownToHtml(t.body, vars)),
    text: markdownToText(interpolate(t.body, vars)),
  };
}

export function emailLayout(inner: string): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#F6EEE8;font-family:Helvetica,Arial,sans-serif;color:#24030F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6EEE8;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBF6F2;border:1px solid #E7D6CB">
<tr><td style="background:#460328;padding:26px;text-align:center;color:#F7CDD0;font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:1px">solei</td></tr>
<tr><td style="padding:32px;font-size:15px;line-height:1.6">${inner}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #E7D6CB;font-size:12px;color:#6A4655;text-align:center">Solei · Abu Dhabi · Made to remain.</td></tr>
</table></td></tr></table></body></html>`;
}
