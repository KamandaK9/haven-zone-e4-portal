import type { Block, HandbookContent, ListItem } from "./types";

export type SearchEntry = {
  href: string;
  // "Procedures › How to split an existing chapter"
  trail: string;
  title: string;
  text: string;
};

function listText(items: ListItem[]): string[] {
  return items.flatMap((i) => (typeof i === "string" ? [i] : [i.text, ...listText(i.items)]));
}

function blockText(b: Block): string[] {
  switch (b.type) {
    case "paragraph":
      return [b.text];
    case "list":
      return listText(b.items);
    case "callout":
      return [b.title ?? "", b.text];
    case "steps":
      return b.steps.flatMap((s) => [s.title, s.detail ?? "", s.actor ?? "", s.deadline ?? ""]);
    case "flow":
      return [b.title ?? "", ...b.stages.flatMap((s) => [s.via ?? "", ...s.nodes.flatMap((n) => [n.label, n.detail ?? ""])])];
    case "meetings":
      return b.meetings.flatMap((m) => [m.name, m.cadence, m.attendance, m.deadline ?? "", ...m.points]);
    case "checklist":
      return b.items.map((i) => i.text);
    default:
      return [];
  }
}

// One entry per section and per office, so a hit lands on something that
// can be scrolled to.
export function buildSearchIndex(content: HandbookContent): SearchEntry[] {
  const sections = content.pages.flatMap((page) =>
    page.sections.map((section) => ({
      href: `/handbook/${page.slug}#${section.id}`,
      trail: page.title,
      title: section.title,
      text: section.blocks.flatMap(blockText).filter(Boolean).join(" "),
    }))
  );
  const structure = content.pages.find((p) => p.sections.some((s) => s.blocks.some((b) => b.type === "orgChart")));
  const roles = structure
    ? content.roles.map((role) => ({
        href: `/handbook/${structure.slug}?role=${role.id}#org-chart`,
        trail: "Offices",
        title: role.title,
        text: [role.summary, ...role.responsibilities, ...role.facts.map((f) => `${f.label} ${f.value}`)].join(" "),
      }))
    : [];
  return [...roles, ...sections];
}
