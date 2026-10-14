/**
 * Phone numbers are stored in E.164 (`+971501234567`) and used as the customer dedupe key.
 * Local UAE formats are normalised; other countries must be entered with a `+` or `00` prefix.
 */

export const UAE_COUNTRY_CODE = "971";

/** UAE mobile: 5X + 7 digits (050, 052, 054, 055, 056, 058). Landlines: area code (2,3,4,6,7,9) + 7 digits. */
const UAE_MOBILE = /^5[024568]\d{7}$/;
const UAE_LANDLINE = /^[234679]\d{7}$/;

export type PhoneResult =
  { ok: true; e164: string; isUaeMobile: boolean } | { ok: false; error: string };

export function normalizePhone(input: string): PhoneResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Enter a phone number" };
  let digits = raw.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return { ok: false, error: "Phone number can only contain digits" };

  let international: string;
  if (digits.startsWith("+")) international = digits.slice(1);
  else if (digits.startsWith("00")) international = digits.slice(2);
  else {
    // Local UAE: 0501234567 or 501234567
    if (digits.startsWith("0")) digits = digits.slice(1);
    international = UAE_COUNTRY_CODE + digits;
  }

  if (international.startsWith(UAE_COUNTRY_CODE)) {
    let national = international.slice(UAE_COUNTRY_CODE.length);
    if (national.startsWith("0")) national = national.slice(1); // +971 050… typo
    const isUaeMobile = UAE_MOBILE.test(national);
    if (!isUaeMobile && !UAE_LANDLINE.test(national)) {
      return { ok: false, error: "Enter a valid UAE number, e.g. 050 123 4567" };
    }
    return { ok: true, e164: `+${UAE_COUNTRY_CODE}${national}`, isUaeMobile };
  }

  if (international.length < 8 || international.length > 15) {
    return { ok: false, error: "Enter a valid international number" };
  }
  return { ok: true, e164: `+${international}`, isUaeMobile: false };
}

/** `+971501234567` → `+971 50 123 4567` for display. */
export function formatPhone(e164: string): string {
  const m = e164.match(/^\+971(5\d)(\d{3})(\d{4})$/);
  return m ? `+971 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Digits only, as required by `wa.me/<number>` links. */
export function waNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
