"use client";

import { useState } from "react";
import { CalendarNav, MonthCalendar } from "@/components/calendar/month-calendar";
import { EVENTS } from "@/lib/data/seed";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
  const [cursor, setCursor] = useState({ year: 2026, month: 8 }); // September 2026

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

      <MonthCalendar events={EVENTS} year={cursor.year} month={cursor.month} />
    </div>
  );
}
