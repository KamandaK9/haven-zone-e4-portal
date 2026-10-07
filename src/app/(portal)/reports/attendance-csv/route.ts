import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getZoneCells } from "@/lib/data/cells";
import { churchToday, getAttendanceData } from "@/lib/data/attendance";
import { summarise } from "@/lib/attendance/summary";
import { logAudit } from "@/lib/actions/audit";
import { labels } from "@/lib/labels";
import { tenant } from "@/tenant";
import { getModules } from "@/lib/modules-server";

// Everyone's attendance standing as a spreadsheet. Needs export_data;
// contact numbers only for those who may see contact details. Every export
// is written to the audit log.
const csv = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !can(profile, "export_data") || !(await getModules()).attendance) return new Response("Not permitted", { status: 403 });

  const [ds, cells, data] = await Promise.all([getZoneDataset(profile.zoneId), getZoneCells(profile.zoneId), getAttendanceData()]);
  const cellName = new Map(cells.map((c) => [c.id, c.name]));
  const churchName = new Map(ds.churches.map((c) => [c.id, c.name]));
  const contacts = can(profile, "view_contact_details");
  const members = ds.members.filter((m) => !m.isVisitor);
  const standing = summarise(members, data.services, data.attendance, churchToday());
  const group = (key?: string) => tenant.ageGroups?.find((g) => g.key === key)?.label ?? "";

  const header = ["Name", labels.location, labels.cell, "Age group", ...(contacts ? ["Phone"] : []), "Status", "Sundays missed in a row", "Last attended"];
  const rows = members
    .map((m) => {
      const s = standing.get(m.id);
      return [
        `${m.firstName} ${m.lastName}`.trim(),
        churchName.get(m.churchId) ?? "",
        (m.cellId && cellName.get(m.cellId)) || "",
        group(m.ageGroup),
        ...(contacts ? [m.phone ?? ""] : []),
        s?.status ?? "",
        s?.missedInARow ?? "",
        s?.lastAttended ?? "",
      ];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  await logAudit(profile, "export.attendance", `Downloaded attendance for ${rows.length} members`);
  const body = [header, ...rows].map((r) => r.map(csv).join(",")).join("\n");
  return new Response(`﻿${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${churchToday()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
