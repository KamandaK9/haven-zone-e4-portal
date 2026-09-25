import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar/calendar-view";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";

export default async function CalendarPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);

  return <CalendarView events={ds.events} ds={ds} canManage={can(profile, "manage_calendar")} />;
}
