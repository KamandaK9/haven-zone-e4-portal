// Pure helpers for writing and costing messages.

// The GSM-7 alphabet. A text using only these fits 160 characters per
// segment (153 when it spans several); anything else (emoji, curly quotes,
// most accents) switches the whole message to Unicode: 70 per segment (67
// when it spans several). Characters in the extension table take two places.
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€\f";

export function smsSegments(text: string): { segments: number; length: number; unicode: boolean } {
  let units = 0;
  let unicode = false;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXTENDED.includes(ch)) units += 2;
    else unicode = true;
  }
  if (unicode) {
    const length = [...text].reduce((n, ch) => n + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0);
    return { segments: length <= 70 ? 1 : Math.ceil(length / 67), length, unicode: true };
  }
  return { segments: units <= 160 ? 1 : Math.ceil(units / 153), length: units, unicode: false };
}

// "{first_name}" style tags; unknown tags are left as written so a typo is
// visible in the preview rather than silently vanishing.
export const MERGE_TAGS = ["first_name", "name", "guardian_name", "church"] as const;

export function renderMessage(template: string, vars: Partial<Record<(typeof MERGE_TAGS)[number], string>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, tag: string) => (tag in vars && vars[tag as (typeof MERGE_TAGS)[number]] ? vars[tag as (typeof MERGE_TAGS)[number]]! : whole));
}

// A phone number the way Twilio wants it (+27821234567). Numbers typed
// locally (082 123 4567), with the country code (27 82…) or with a + are all
// accepted; anything that can't be a real number is undefined.
export function toE164(raw: string | null | undefined, countryCode = "27"): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return undefined;
  let international: string;
  if (trimmed.startsWith("+")) international = digits;
  else if (trimmed.startsWith("00")) international = digits.slice(2);
  else if (digits.startsWith("0")) international = countryCode + digits.slice(1);
  else if (digits.startsWith(countryCode) && digits.length >= countryCode.length + 8) international = digits;
  else international = countryCode + digits;
  return international.length >= 10 && international.length <= 15 ? `+${international}` : undefined;
}

// Last nine digits — how members are matched to an incoming number.
export const phoneKey = (raw: string | null | undefined): string | undefined => {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : undefined;
};

// "04-12" or "1990-04-12" → month/day; free text is not a date.
export function birthdayMonthDay(raw: string | null | undefined): { month: number; day: number } | undefined {
  const m = (raw ?? "").trim().match(/^(?:\d{4}-)?(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { month, day } : undefined;
}
