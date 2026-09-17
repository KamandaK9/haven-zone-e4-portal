"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getChurch, type Dataset } from "@/lib/data/analytics";
import type { CalendarEvent, CalendarEventType } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<CalendarEventType, { dot: string; badge: string; label: string }> = {
  meeting: { dot: "bg-violet-600", badge: "bg-violet-50 text-violet-700 border-violet-200", label: "Meeting" },
  training: { dot: "bg-sky-600", badge: "bg-sky-50 text-sky-700 border-sky-200", label: "Training" },
  service: { dot: "bg-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Service" },
  outreach: { dot: "bg-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Outreach" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthCalendar({
  events,
  year,
  month,
  ds,
}: {
  events: CalendarEvent[];
  year: number;
  month: number;
  ds: Dataset;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), e]);
    }
  }

  const selectedEvents = selected
    ? (eventsByDay.get(Number(selected)) ?? []).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-xl border overflow-hidden bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayEvents = day ? eventsByDay.get(day) ?? [] : [];
            const isSelected = day !== null && String(day) === selected;
            return (
              <button
                key={i}
                disabled={day === null}
                onClick={() => day && setSelected(String(day))}
                className={cn(
                  "min-h-[92px] border-b border-r p-1.5 text-left align-top transition-colors last:border-r-0",
                  day === null && "bg-muted/20",
                  day !== null && "hover:bg-accent",
                  isSelected && "bg-accent ring-1 ring-inset ring-primary"
                )}
              >
                {day && (
                  <>
                    <span className="text-xs font-medium text-foreground">{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div key={e.id} className="flex items-center gap-1 truncate">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TYPE_STYLES[e.type].dot)} />
                          <span className="text-[10px] truncate text-muted-foreground">{e.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[10px] text-muted-foreground pl-2.5">+{dayEvents.length - 2} more</p>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium mb-3">
            {selected
              ? new Date(year, month, Number(selected)).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "Select a day"}
          </p>
          {selected && selectedEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">No events scheduled.</p>
          )}
          <div className="space-y-3">
            {selectedEvents.map((e) => {
              const church = e.churchId ? getChurch(ds, e.churchId) : undefined;
              return (
                <div key={e.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{e.title}</p>
                    <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", TYPE_STYLES[e.type].badge)}>
                      {TYPE_STYLES[e.type].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {e.time}
                  </div>
                  {church && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {church.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium mb-3">Event types</p>
          <div className="space-y-2">
            {(Object.keys(TYPE_STYLES) as CalendarEventType[]).map((type) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <span className={cn("h-2 w-2 rounded-full", TYPE_STYLES[type].dot)} />
                {TYPE_STYLES[type].label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarNav({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium w-32 text-center">{label}</span>
      <Button variant="outline" size="icon" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
