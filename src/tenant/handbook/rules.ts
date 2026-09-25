import type { HandbookRules } from "@/lib/handbook/types";

// Thresholds from the SOP tables (amended 2015), in USD. The SOP says these
// "may change from time to time", so they're only defaults — a Director can
// override them per zone in Settings.
//
// Where the SOP writes ">" (e.g. ">120 members", ">15 chapters") the minimum
// here is the next whole number up; dollar floors are taken as written.
export const rules: HandbookRules = {
  yearLabel: "ministry year",

  zone: [
    { code: "A", label: "Category A", minAmount: 2_500_000, minChapters: 16, minMembers: 201 },
    { code: "B", label: "Category B", minAmount: 1_750_000, minChapters: 15, minMembers: 200 },
    { code: "C", label: "Category C", minAmount: 1_000_000, minChapters: 10, minMembers: 150 },
    {
      code: "PRECAT",
      label: "PRECAT Zone",
      minAmount: 0,
      minChapters: 0,
      minMembers: 0,
      note: "Reports under another Zone and does not have a Zonal Director",
    },
  ],

  chapter: [
    { code: "A", label: "Category A", minAmount: 375_100, minMembers: 121 },
    { code: "B", label: "Category B", minAmount: 175_100, minMembers: 100 },
    { code: "C", label: "Category C", minAmount: 85_100, minMembers: 60 },
    { code: "D", label: "Category D", minAmount: 55_100, minMembers: 25 },
    { code: "E", label: "Category E", minAmount: 40_100, minMembers: 15 },
    { code: "PRECAT 1", label: "PRECAT 1", minAmount: 25_100, minMembers: 15 },
    { code: "PRECAT 2", label: "PRECAT 2", minAmount: 10_100, minMembers: 15 },
    { code: "PRECAT 3", label: "PRECAT 3", minAmount: 3_000, minMembers: 15 },
  ],

  member: {
    rankTier: { code: "platinum", label: "Platinum", color: "#64748b", topN: 3, years: 3 },
    rungs: [
      { code: "diamond", label: "Diamond", minAmount: 200_000, color: "#0891b2" },
      { code: "gold", label: "Gold", minAmount: 80_000, color: "#ca8a04" },
      { code: "silver", label: "Silver", minAmount: 35_000, color: "#94a3b8" },
      { code: "bronze", label: "Bronze", minAmount: 15_000, color: "#b45309" },
      { code: "purple", label: "Purple", minAmount: 4_000, color: "#7c3aed" },
      { code: "blue", label: "Blue", minAmount: 0, color: "#2563eb" },
    ],
  },

  governorship: [
    {
      title: "Governor",
      alias: "Haven Millionaire",
      minAmount: 35_000,
      requirements: [
        "Should have attended at least three NEAs and three Haven Conventions",
        "Should have been invited by the International President to attend the Haven Training seminars designed specifically for aspiring Haven Governors",
        "Shall pay tithe to the local church",
      ],
    },
    {
      title: "Deputy Governor",
      minAmount: 17_500,
      requirements: [
        "Should give at least half the amount expected by a Haven Governor, which is twice the amount given by an Assistant Governor",
        "Should have attended at least two NEAs and two Haven Conventions",
        "Should be at least a senior cell leader in The Haven",
        "Shall pay tithe to the local church",
      ],
    },
    {
      title: "Assistant Governor (Administration/Finance)",
      alias: "Haven Mighty Man/Woman",
      minAmount: 8_750,
      requirements: [
        "Should have attended at least one NEA and one Haven Convention",
        "Should be at least a senior cell leader in the Haven",
        "Shall pay tithe to the local church",
      ],
    },
    {
      title: "Coordinator",
      alias: "Expected to be from new chapters",
      minAmount: 5_000,
      requirements: [
        "Should be a bona fide member of The Haven, giving slightly above the minimum for membership",
        "Should have attended at least one NEA",
        "Should have attended The Haven Training seminars for Coordinators",
        "Should be at least a cell leader in The Haven",
        "Shall pay tithe to the local church",
      ],
    },
    {
      title: "Ag Coordinator",
      alias: "Expected to be from new chapters",
      minAmount: 4_500,
      requirements: [
        "Should be a bona fide member of The Haven",
        "Should be scheduled to attend the very next NEA",
        "Should be scheduled to attend The Haven Training seminars for Coordinators",
        "Should be at least a cell leader",
        "Shall pay tithe to the local church",
      ],
    },
  ],
};
