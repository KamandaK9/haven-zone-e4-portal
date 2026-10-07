// members.birthday is free text: the leadership-roster import keeps whatever
// the sheet said, while the member-sheet import stores "YYYY-MM-DD", or
// "MM-DD" when the year isn't known. Those two are shown as "12 April 1990"
// / "12 April"; anything else is shown as-is.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatBirthday(raw: string): string {
  const m = raw.match(/^(?:(\d{4})-)?(\d{2})-(\d{2})$/);
  if (!m) return raw;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return raw;
  return [Number(m[3]), month, m[1]].filter(Boolean).join(" ");
}
