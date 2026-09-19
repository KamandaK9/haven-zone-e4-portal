"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import type { CalendarEventType } from "@/lib/data/types";
import type { ActionResult } from "./members";

type CreateEventInput = {
  title: string;
  date: string;
  time: string;
  type: CalendarEventType;
  churchId?: string;
  countryId?: string;
};

export async function createCalendarEvent(input: CreateEventInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member") return { ok: false, error: "Not permitted." };
  if (!input.title.trim() || !input.date || !input.time) {
    return { ok: false, error: "Title, date, and time are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    zone_id: profile.zoneId,
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    type: input.type,
    church_id: input.churchId || null,
    country_id: input.countryId || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/me/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}
