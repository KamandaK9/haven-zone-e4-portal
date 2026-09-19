"use client";

import { useState } from "react";
import { CalendarNav, MonthCalendar } from "@/components/calendar/month-calendar";
import { AddEventDialog } from "@/components/calendar/add-event-dialog";
import type { Dataset } from "@/lib/data/analytics";
import type { CalendarEvent } from "@/lib/data/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView({
  events,
  ds,
  canManage = false,
}: {
  events: CalendarEvent[];
  ds: Dataset;
  canManage?: boolean;
}) {
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
        <div className="flex items-center gap-2">
          <CalendarNav
            label={`${MONTH_NAMES[cursor.month]} ${cursor.year}`}
            onPrev={() => shiftMonth(-1)}
            onNext={() => shiftMonth(1)}
          />
          {canManage && <AddEventDialog churches={ds.churches} />}
        </div>
      </div>

      <MonthCalendar events={events} year={cursor.year} month={cursor.month} ds={ds} />
    </div>
  );
}
