"use client";

import { PortalTopbar } from "@/components/layout/portal-shell";
import { MEMBER_NAV_ITEMS } from "./member-sidebar";

export function MemberTopbar({ zoneName, fullName }: { zoneName: string; fullName: string }) {
  return (
    <PortalTopbar zoneName={zoneName} fullName={fullName} identityLabel="Member" navItems={MEMBER_NAV_ITEMS} />
  );
}
