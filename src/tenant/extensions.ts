import "server-only";
import type { TenantExtensions } from "@/lib/tenant";

// This organisation's own logic, beyond what Stratum does for everyone:
// extra pages, dashboard cards, and hooks for integrations. Only the server
// loads this file, so it can use server-only code and secrets
// (process.env). Stratum updates never overwrite it.
//
// Example — a page listed in the sidebar (declare it in index.ts:
//   extensionPages: [{ slug: "partners", label: "Partners", icon: Handshake, cap: "view_members" }])
// and its body here:
//
//   pages: {
//     partners: async ({ profile }) => <PartnersPage zoneId={profile.zoneId} />,
//   },
//   hooks: {
//     onMembersCreated: async ({ memberIds }) => { await sendToCrm(memberIds); },
//   },
export const extensions: TenantExtensions = {};
