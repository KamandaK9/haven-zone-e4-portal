"use client";

import { useState } from "react";
import { CalendarNav, MonthCalendar } from "@/components/calendar/month-calendar";
import { useZone } from "@/lib/data/zone-context";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
  const { data: ds } = useZone();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      let month = prev.month + delta;
      let year = prev.year;
      if (month < 0) {
        month = 11;
        year -= 1;
      } else if (month > 11) {
        month = 0;
        year += 1;
      }
      return { year, month };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Zone-wide meetings, trainings, and services.</p>
        </div>
        <CalendarNav
          label={`${MONTH_NAMES[cursor.month]} ${cursor.year}`}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
        />
      </div>

      <MonthCalendar events={ds.events} year={cursor.year} month={cursor.month} ds={ds} />
    </div>
  );
}
