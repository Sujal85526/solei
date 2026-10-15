import { emailLayout, escapeHtml } from "@/modules/notifications/render";

/**
 * Account security emails (verification and password-reset codes). These are system emails, not
 * owner-editable notifications; the code is also in the subject so it shows in inbox previews.
 */
export function accountCodeEmail(kind: "verify" | "reset", code: string, firstName?: string) {
  const hello = firstName ? `Hello ${escapeHtml(firstName)},` : "Hello,";
  const lead =
    kind === "verify"
      ? "Use this code to verify your email and finish creating your Solei account."
      : "Use this code to reset your Solei password.";
  const subject =
    kind === "verify"
      ? `${code} is your Solei verification code`
      : `${code} is your Solei reset code`;
  const html = emailLayout(
    `<p style="margin:0 0 16px">${hello}</p>
<p style="margin:0 0 24px">${lead}</p>
<p style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:10px;color:#460328">${code}</p>
<p style="margin:0;color:#6A4655;font-size:13px">The code expires in one hour. If you didn't ask for it, you can ignore this email.</p>`,
  );
  const text = `${hello}\n\n${lead}\n\n${code}\n\nThe code expires in one hour. If you didn't ask for it, you can ignore this email.`;
  return { subject, html, text };
}
