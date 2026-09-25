// "12–15 March 2026", "28 Feb – 2 Mar 2026", or a single day. Dates are
// 'YYYY-MM-DD' strings; parsed as local dates so they never shift a day.
export function formatEventDates(start: string, end?: string): string {
  const s = new Date(`${start}T00:00:00`);
  if (!end || end === start) {
    return s.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  const e = new Date(`${end}T00:00:00`);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  const short = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  return s.getFullYear() === e.getFullYear()
    ? `${short(s, false)} – ${short(e, true)}`
    : `${short(s, true)} – ${short(e, true)}`;
}

export function isPastEvent(start: string, end?: string, now = new Date()): boolean {
  const last = new Date(`${end ?? start}T23:59:59`);
  return last.getTime() < now.getTime();
}
