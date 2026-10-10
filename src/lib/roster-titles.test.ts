import { describe, expect, it } from "vitest";
import { parseDesignation } from "./access";
import { NETWORK_ROSTER_TITLES } from "./roster-titles";
import type { PositionDef } from "./tenant";

// The title parser as it was hard-coded in core before the rules moved to
// tenant settings — kept here to prove the move changes nothing.
function legacy(raw: string | undefined): { position: string; portfolio: string | null; unrecognised: boolean } {
  const portfolioFromText = (t: string) => {
    if (/financ|\bdgf\b|\bfin\b/.test(t)) return "finance";
    if (/program/.test(t)) return "programs";
    if (/admin|\bdga\b/.test(t)) return "administration";
    if (/operation|\bdgo\b|\bdeputy govern\w*\s*:?\s*o\b/.test(t)) return "operations";
    return null;
  };
  const t = (raw ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  const plain = (position: string, portfolio: string | null = null) => ({ position, portfolio, unrecognised: false });
  if (!t || /^(members?|brother|sister)$/.test(t)) return plain("member");
  if (/assistant zonal director/.test(t)) return plain("assistant_zonal_director");
  if (/zonal director/.test(t)) return plain("zonal_director");
  if (/deputy zonal secretary/.test(t)) return plain("deputy_zonal_secretary", portfolioFromText(t));
  if (/zonal secretary/.test(t)) return plain("zonal_secretary", portfolioFromText(t));
  if (/sub ?zone governor|\bszg\b/.test(t)) return plain("sub_zone_governor");
  if (/^dg\b|\bdg[afo]\b|deputy g|dg /.test(t)) return plain("deputy_governor", portfolioFromText(t));
  if (/^gov(ern[eo]r)?$|^governor/.test(t)) return plain("governor");
  if (/financ\w* secretary/.test(t)) return plain("deputy_governor", "finance");
  if (/cell leader|pastor|special|general secretary|^secretary$|coordinator/.test(t)) return plain("member");
  return { position: "member", portfolio: null, unrecognised: true };
}

const pos = (key: string, label: string, portfolios = false): PositionDef =>
  ({ key, label, rank: 0, scope: "zone", loginRole: "admin", baseCaps: [], ...(portfolios ? { portfolioCaps: {} } : {}) }) as PositionDef;
const access = {
  memberPositionKey: "member",
  positions: [
    pos("zonal_director", "Zonal Director"),
    pos("assistant_zonal_director", "Assistant Zonal Director"),
    pos("zonal_secretary", "Zonal Secretary", true),
    pos("deputy_zonal_secretary", "Deputy Zonal Secretary", true),
    pos("sub_zone_governor", "Sub Zone Governor"),
    pos("governor", "Governor"),
    pos("deputy_governor", "Deputy Governor", true),
    pos("member", "Member"),
  ],
  portfolios: [
    { key: "finance", label: "Finance" },
    { key: "programs", label: "Programs" },
    { key: "administration", label: "Administration" },
    { key: "operations", label: "Operations" },
  ],
};

const TITLES = [
  "", "Member", "members", "Brother", "Sister", "Zonal Director", "ASSISTANT ZONAL DIRECTOR", "Asst. Zonal Director",
  "Zonal Secretary", "Zonal Secretary - Finance", "Zonal Secretary (Programs)", "Deputy Zonal Secretary: Admin",
  "Deputy Zonal Secretary Operations", "SZG", "SZG 3", "Sub Zone Governor", "Subzone Governor", "SZ Governor",
  "DG", "DGF", "DGA", "DGO", "DG Finance", "DG - Programs", "Deputy Governor", "Deputy Governor: Finance",
  "Deputy Governor O", "Deputy Gov Admin", "Governor", "Gov", "Govener", "Governor (acting)", "Finance Secretary",
  "Financial Secretary", "Cell Leader", "Pastor", "Special Assistant", "General Secretary", "Secretary",
  "Coordinator", "Dues Champion", "Usher", "Choir", "Chapter Governor", "Acting Governor",
];

describe("roster titles from tenant settings", () => {
  it("give the same position and portfolio as the old hard-coded parser", () => {
    for (const title of TITLES) {
      const before = legacy(title);
      const after = parseDesignation(title, NETWORK_ROSTER_TITLES, access);
      if (before.unrecognised) {
        // Only titles the old parser couldn't place may now match a label.
        if (after.unrecognised) expect(after, title).toEqual(before);
      } else {
        expect(after, title).toEqual(before);
      }
    }
  });

  it("places titles it couldn't before by their position labels", () => {
    expect(parseDesignation("Chapter Governor", NETWORK_ROSTER_TITLES, access).position).toBe("governor");
    expect(parseDesignation("Usher", NETWORK_ROSTER_TITLES, access)).toEqual({ position: "member", portfolio: null, unrecognised: true });
  });

  it("works for an organisation with no title rules, on labels alone", () => {
    const shop = {
      memberPositionKey: "staff",
      positions: [pos("owner", "Owner"), pos("branch_manager", "Branch Manager"), pos("manager", "Manager"), pos("staff", "Staff")],
      portfolios: [],
    };
    expect(parseDesignation("Branch Manager (Durban)", {}, shop).position).toBe("branch_manager");
    expect(parseDesignation("manager", {}, shop).position).toBe("manager");
    expect(parseDesignation("Cashier", {}, shop)).toEqual({ position: "staff", portfolio: null, unrecognised: true });
  });
});
