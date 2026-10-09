// How each cell's weekly meetings are going, from the registers taken.

export type MeetingLite = { cellId: string; date: string; attendees: number };

export type CellMeetingSummary = {
  cellId: string;
  meetings: number; // in the window
  averageAttendance: number;
  lastMet?: string;
  daysSinceLastMet?: number;
  // Hasn't met for a while — or never has.
  quiet: boolean;
};

export const QUIET_AFTER_DAYS = 21;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export function summariseCells(cellIds: string[], meetings: MeetingLite[], today: string): CellMeetingSummary[] {
  return cellIds.map((cellId) => {
    const mine = meetings.filter((m) => m.cellId === cellId).sort((a, b) => b.date.localeCompare(a.date));
    const lastMet = mine[0]?.date;
    const daysSince = lastMet ? daysBetween(lastMet, today) : undefined;
    return {
      cellId,
      meetings: mine.length,
      averageAttendance: mine.length ? Math.round(mine.reduce((n, m) => n + m.attendees, 0) / mine.length) : 0,
      lastMet,
      daysSinceLastMet: daysSince,
      quiet: daysSince === undefined || daysSince > QUIET_AFTER_DAYS,
    };
  });
}
