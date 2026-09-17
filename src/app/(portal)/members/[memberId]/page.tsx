"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Mail, Phone, Calendar, HandCoins, Clock, CheckCircle2, CircleDashed, CircleDot } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MemberGivingChart } from "@/components/charts/member-giving-chart";
import { useZone } from "@/lib/data/zone-context";
import {
  getChurch,
  getCountry,
  getMember,
  memberFullName,
  memberTenureYears,
  memberTotalGiving,
} from "@/lib/data/analytics";
import type { LessonStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<LessonStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, className: "text-emerald-600" },
  in_progress: { label: "In progress", icon: CircleDot, className: "text-amber-600" },
  not_started: { label: "Not started", icon: CircleDashed, className: "text-muted-foreground" },
};

export default function MemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const { data: ds } = useZone();
  const member = getMember(ds, memberId);

  if (!member) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Zone Dashboard", href: "/dashboard" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This member doesn&apos;t exist.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const church = getChurch(ds, member.churchId);
  const country = getCountry(ds, member.countryId);
  const totalGiving = memberTotalGiving(member);
  const tenure = memberTenureYears(member);
  const completed = member.trainings.filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Zone Dashboard", href: "/dashboard" },
          { label: country?.name ?? "Country", href: `/countries/${member.countryId}` },
          { label: church?.name ?? "Church", href: `/churches/${member.churchId}` },
          { label: memberFullName(member) },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback
            className="text-lg font-semibold text-white"
            style={{ backgroundColor: member.avatarColor }}
          >
            {member.firstName[0]}
            {member.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{memberFullName(member)}</h1>
            <Badge variant="secondary" className="font-normal">{member.role}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <Link href={`/churches/${member.churchId}`} className="hover:text-primary transition-colors">
              {church?.name}
            </Link>
            <span className="flex items-center gap-1">
              {country?.flag} {country?.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {new Date(member.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
            <a href={`mailto:${member.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors">
              <Mail className="h-3.5 w-3.5" /> {member.email}
            </a>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {member.phone}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total giving" value={`$${totalGiving.toLocaleString()}`} icon={HandCoins} />
        <StatCard label="Time in Haven" value={tenure < 0.1 ? "New" : `${tenure.toFixed(1)} yrs`} icon={Clock} />
        <StatCard label="Trainings complete" value={`${completed}/${member.trainings.length}`} icon={CheckCircle2} />
        <StatCard label="Avg. gift" value={`$${member.giving.length ? Math.round(totalGiving / member.giving.length).toLocaleString() : "0"}`} icon={HandCoins} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Giving history</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {member.giving.length > 0 ? (
              <MemberGivingChart data={member.giving} />
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No giving recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Training &amp; lessons</CardTitle>
            <CardDescription>Discipleship progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {member.trainings.map((t) => {
              const meta = STATUS_META[t.status];
              const Icon = meta.icon;
              return (
                <div key={t.name} className="flex items-center gap-2.5">
                  <Icon className={cn("h-4 w-4 shrink-0", meta.className)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className={cn("text-xs", meta.className)}>{meta.label}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
