import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PaginationBar, clampPage } from "@/components/ui/pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccessEditDialog, RefreshPermissionsButton } from "@/components/settings/access-editor";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { createClient } from "@/lib/supabase/server";
import { getChurch, memberFullName } from "@/lib/data/analytics";
import { isCapability, PORTFOLIO_LABELS, POSITION_LABELS, positionRank, type Capability } from "@/lib/access";

const PAGE_SIZE = 20;

export default async function TeamAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/dashboard");

  const ds = await getZoneDataset(profile.zoneId);

  // Per-person overrides live on the login row, not on the member.
  const supabase = await createClient();
  const { data: logins } = await supabase.from("profiles").select("id, granted_caps, revoked_caps").eq("zone_id", profile.zoneId);
  const overridesByLogin = new Map(
    (logins ?? []).map((l) => [
      l.id,
      { granted: l.granted_caps.filter(isCapability) as Capability[], revoked: l.revoked_caps.filter(isCapability) as Capability[] },
    ])
  );

  const params = await searchParams;
  const leaders = ds.members
    .filter((m) => m.position !== "member")
    .sort((a, b) => positionRank(a.position) - positionRank(b.position) || memberFullName(a).localeCompare(memberFullName(b)));

  const page = clampPage(params.page, leaders.length, PAGE_SIZE);
  const visibleLeaders = leaders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Settings
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Team &amp; access</h1>
            <p className="text-sm text-muted-foreground">
              Everyone holding a leadership position, and what each can see. Position sets the defaults; edit a person to
              change them.
            </p>
          </div>
          <RefreshPermissionsButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leadership</CardTitle>
          <CardDescription>
            {leaders.length} {leaders.length === 1 ? "person" : "people"} · a Governor sees only their chapter, a Sub Zone
            Governor their sub-zone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLeaders.map((m) => {
                  const loginOverrides = m.profileId ? overridesByLogin.get(m.profileId) : undefined;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-medium">{memberFullName(m)}</TableCell>
                      <TableCell className="text-sm">
                        {POSITION_LABELS[m.position]}
                        {m.portfolio && <span className="text-muted-foreground"> · {PORTFOLIO_LABELS[m.portfolio]}</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{getChurch(ds, m.churchId)?.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {m.hasPortalAccess ? "Has login" : "No login"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <AccessEditDialog
                          memberId={m.id}
                          name={memberFullName(m)}
                          position={m.position}
                          portfolio={m.portfolio ?? null}
                          hasLogin={m.hasPortalAccess}
                          granted={loginOverrides?.granted ?? []}
                          revoked={loginOverrides?.revoked ?? []}
                          actorPosition={profile.position}
                          actorCaps={profile.caps}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {leaders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                      No leadership positions recorded yet — import the roster from Zone Setup.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={leaders.length}
            hrefFor={(p) => (p === 1 ? "/settings/access" : `/settings/access?page=${p}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
