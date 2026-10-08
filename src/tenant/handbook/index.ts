import { CalendarClock, ListChecks, Network, Trophy } from "lucide-react";
import type { HandbookContent } from "@/lib/handbook/types";

// A short sample handbook showing each kind of block Stratum can render. A
// real tenant transcribes its own operating manual here.
export const handbook: HandbookContent = {
  title: "Handbook",
  source: "Example Church Operating Guide (sample)",
  sourceShort: "Guide",
  intro: {
    about: [
      "This is sample content. Replace it with your organisation's own story, structure and procedures — each page below shows one of the ways Stratum can present them.",
    ],
    vision: "To be a church family where everyone belongs, grows and serves.",
    mission: ["We gather, equip and send people to love their neighbours well."],
    objectives: ["Welcome every newcomer personally", "Grow leaders in every branch", "Give generously to the work beyond us"],
  },
  roles: [
    {
      id: "board",
      title: "Board of Elders",
      level: "Church",
      parentId: null,
      summary: "Sets direction and appoints the Senior Pastor.",
      responsibilities: ["Approves the annual plan and budget", "Appoints and supports the Senior Pastor"],
      facts: [{ label: "Meets", value: "Quarterly" }],
    },
    {
      id: "director",
      title: "Senior Pastor",
      level: "Church",
      parentId: "board",
      summary: "Leads the church and its regional leaders.",
      responsibilities: ["Leads worship and teaching", "Oversees every region"],
      facts: [{ label: "Reports to", value: "The Board of Elders" }],
      position: "zonal_director",
    },
    {
      id: "branch-lead",
      title: "Branch Leader",
      level: "Branch",
      parentId: "director",
      summary: "Leads one branch and its cell groups.",
      responsibilities: ["Grows and cares for the branch", "Submits a monthly report"],
      facts: [{ label: "Tenure", value: "Two years, renewable" }],
      position: "governor",
    },
  ],
  pages: [
    {
      slug: "structure",
      title: "Structure",
      summary: "Who leads what.",
      icon: Network,
      sections: [{ id: "org-chart", title: "Organisation chart", blocks: [{ type: "orgChart" }] }],
    },
    {
      slug: "categories",
      title: "Categories",
      summary: "How branches and members are recognised each year.",
      icon: Trophy,
      sections: [
        { id: "branches", title: "Branch categories", blocks: [{ type: "ladder", ladder: "chapter" }, { type: "live", widget: "chapterStandings" }] },
        { id: "members", title: "Partner tiers", blocks: [{ type: "ladder", ladder: "member" }, { type: "live", widget: "myTier" }] },
      ],
    },
    {
      slug: "meetings",
      title: "Meetings",
      summary: "The gatherings that keep us on track.",
      icon: CalendarClock,
      sections: [
        {
          id: "meetings",
          title: "Regular meetings",
          blocks: [
            {
              type: "meetings",
              meetings: [
                { name: "Annual Conference", cadence: "Yearly", attendance: "Everyone", seriesSlug: "annual-conference", points: ["Vision for the year ahead"] },
                { name: "Branch meeting", cadence: "Monthly", attendance: "Branch members", points: ["Updates, prayer and planning"] },
              ],
            },
          ],
        },
      ],
    },
    {
      slug: "procedures",
      title: "Procedures",
      summary: "Step by step.",
      icon: ListChecks,
      sections: [
        {
          id: "new-branch",
          title: "Starting a new branch",
          blocks: [
            {
              type: "steps",
              steps: [
                { title: "Propose it", detail: "A leader proposes the branch with a named leader.", actor: "Regional leader" },
                { title: "Approve it", detail: "The Senior Pastor approves.", actor: "Senior Pastor", deadline: "Within 2 weeks" },
                { title: "Launch", detail: "Add the branch in the portal and invite its leader." },
              ],
            },
          ],
        },
      ],
    },
  ],
  rules: {
    yearLabel: "year",
    zone: [
      { code: "A", label: "Category A", minAmount: 500_000, minChapters: 10, minMembers: 500 },
      { code: "B", label: "Category B", minAmount: 0, minChapters: 0, minMembers: 0 },
    ],
    chapter: [
      { code: "A", label: "Category A", minAmount: 50_000, minMembers: 100 },
      { code: "B", label: "Category B", minAmount: 20_000, minMembers: 40 },
      { code: "C", label: "Category C", minAmount: 5_000, minMembers: 10 },
    ],
    member: {
      rankTier: null,
      rungs: [
        { code: "gold", label: "Gold", minAmount: 10_000, color: "#ca8a04" },
        { code: "silver", label: "Silver", minAmount: 2_500, color: "#94a3b8" },
        { code: "friend", label: "Friend", minAmount: 0, color: "#4f46e5" },
      ],
    },
    governorship: [{ title: "Branch Leader", minAmount: 1_000, requirements: ["Two years as a member", "Completed leadership training"] }],
  },
};
