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
import { isCapability, isLeader, portfolioLabel, positionLabel, positionRank, type Capability } from "@/lib/access";
import { labels } from "@/lib/labels";
import { roleOption } from "@/lib/roles";
import { getModules } from "@/lib/modules-server";
import { tenant } from "@/tenant";

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
  const modules = await getModules();

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
    .filter((m) => isLeader(m.position))
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
              Everyone with a role, and what each can see. The role sets the defaults; edit a person to fine-tune them.
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
                  <TableHead>{labels.location}</TableHead>
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
                        {positionLabel(m.position)}
                        {m.portfolio && <span className="text-muted-foreground"> · {portfolioLabel(m.portfolio)}</span>}
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
                      Nobody has a role yet — give someone one from their member page (Change role).
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

      <Card>
        <CardHeader>
          <CardTitle>Roles explained</CardTitle>
          <CardDescription>
            Every role, most senior first. People can give roles below their own; each role sees only its part of the church.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {[...tenant.access.positions]
            .sort((a, b) => a.rank - b.rank)
            .map((p) => {
              const r = roleOption(p.key, modules);
              return (
                <div key={p.key} className="py-3">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sees {r.sees}
                    {r.can.length > 0 && <> · {r.can.join(" · ")}</>}
                  </p>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
