import type { TenantConfig } from "@/lib/tenant";

// Roster-title rules for a church network that writes leadership titles the
// way many zones do ("SZG", "DGF", "Finance Secretary"), with positions keyed
// zonal_director / sub_zone_governor / governor / deputy_governor … and
// finance/programs/administration/operations portfolios. A tenant with that
// structure can use these as its tenant.roster title settings, or copy and
// adjust them.
export const NETWORK_ROSTER_TITLES: Pick<TenantConfig["roster"], "titles" | "portfolioTitles" | "ignoredTitles"> = {
  titles: [
    { match: "^(members?|brother|sister)$", position: "member" },
    { match: "assistant zonal director", position: "assistant_zonal_director", portfolio: null },
    { match: "zonal director", position: "zonal_director", portfolio: null },
    { match: "deputy zonal secretary", position: "deputy_zonal_secretary" },
    { match: "zonal secretary", position: "zonal_secretary" },
    { match: "sub ?zone governor|\\bszg\\b", position: "sub_zone_governor", portfolio: null },
    { match: "^dg\\b|\\bdg[afo]\\b|deputy g|dg ", position: "deputy_governor" },
    { match: "^gov(ern[eo]r)?$|^governor", position: "governor", portfolio: null },
    // A chapter Finance Secretary works like a finance deputy. "Dues
    // Champion" is deliberately not mapped — grant finance access by hand.
    { match: "financ\\w* secretary", position: "deputy_governor", portfolio: "finance" },
  ],
  portfolioTitles: [
    { match: "financ|\\bdgf\\b|\\bfin\\b", portfolio: "finance" },
    { match: "program", portfolio: "programs" },
    { match: "admin|\\bdga\\b", portfolio: "administration" },
    { match: "operation|\\bdgo\\b|\\bdeputy govern\\w*\\s*:?\\s*o\\b", portfolio: "operations" },
  ],
  ignoredTitles: ["cell leader|pastor|special|general secretary|^secretary$|coordinator"],
};
