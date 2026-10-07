import { tenant } from "@/tenant";
import { labels } from "@/lib/labels";

// The dashboard's "Getting started" checklist for a new organisation. Most
// steps tick themselves off from what exists; the rest an admin marks done.
// Add a step here whenever a feature needs setting up (or gets a template).

export type StepFacts = {
  locations: number;
  members: number;
  cells: number;
  logins: number;
  logos: number;
  cohorts: number;
  services: number;
};

export type Step = {
  key: string;
  title: string;
  detail: string;
  href: string;
  done: boolean;
  // Done only when an admin says so (nothing to detect).
  manual?: boolean;
  template?: "members";
};

const l = (s: string) => s.toLowerCase();

export function gettingStartedSteps(f: StepFacts, markedDone: string[]): Step[] {
  const marked = new Set(markedDone);
  const steps: Step[] = [
    {
      key: "locations",
      title: `Add your ${l(labels.locations)}`,
      detail: `Every ${l(labels.location)} gets its own members, ${l(labels.cells)} and leaders. One is enough if that's all you have.`,
      href: "/countries",
      done: f.locations > 1 || marked.has("locations"),
      manual: f.locations <= 1,
    },
    {
      key: "members",
      title: "Import your members",
      detail: `Upload the spreadsheet you already keep — any layout. No spreadsheet? Use the template.`,
      href: "/countries",
      done: f.members > 0,
      template: "members",
    },
    {
      key: "cells",
      title: `Set up your ${l(labels.cells)}`,
      detail: `Created from your spreadsheet on import, or add them on a ${l(labels.location)}'s page.`,
      href: "/countries",
      done: f.cells > 0,
    },
    {
      key: "leaders",
      title: "Invite your leaders",
      detail: "Give pastors, cell leaders, teachers and check-in volunteers their own login, each seeing only their part.",
      href: "/settings/access",
      done: f.logins > 1,
    },
  ];
  if (tenant.modules.resources) {
    steps.push({
      key: "logo",
      title: "Upload your logo",
      detail: "The original file (SVG, PDF or EPS is best) — leaders download it from Resources, always the best version.",
      href: "/resources",
      done: f.logos > 0,
    });
  }
  if (tenant.modules.courses && tenant.course) {
    steps.push({
      key: "course",
      title: `Start a ${tenant.course.name} class group`,
      detail: "Name the classes, choose a teacher and add students.",
      href: "/courses",
      done: f.cohorts > 0,
    });
  }
  if (tenant.modules.attendance) {
    steps.push({
      key: "check-in",
      title: "Check people in on Sunday",
      detail: "Open Check-in on a phone or tablet while online once, add it to the home screen — then it works without internet.",
      href: "/check-in",
      done: f.services > 0,
    });
  }
  return steps;
}
