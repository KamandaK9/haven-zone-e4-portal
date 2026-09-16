"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Users, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getZoneStats } from "@/lib/data/analytics";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const stats = getZoneStats();

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 650);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 70%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white p-1.5">
            <BrandMark size={32} />
          </div>
          <div>
            <p className="font-semibold leading-tight">Haven Zone E4</p>
            <p className="text-xs text-primary-foreground/70 leading-tight">Member Portal</p>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            One view of every church, every member, every country in Zone E4.
          </h1>
          <p className="text-primary-foreground/80 text-[15px] leading-relaxed">
            Track membership growth, tithe and giving analytics, and training
            progress across the zone — from a single dashboard built for
            leadership.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <StatBlock icon={Users} label="Members" value={stats.totalMembers.toLocaleString()} />
            <StatBlock icon={Globe2} label="Countries" value={String(stats.totalCountries)} />
            <StatBlock icon={TrendingUp} label="Churches" value={String(stats.totalChurches)} />
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          An arm of Christ Embassy &middot; Zone E4
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <BrandMark size={44} />
            <div className="text-center">
              <p className="font-semibold">Haven Zone E4</p>
              <p className="text-xs text-muted-foreground">Member Portal</p>
            </div>
          </div>

          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access the Zone E4 dashboard.
            </p>
          </div>

          <Card className="border-0 shadow-none lg:border lg:shadow-sm">
            <CardContent className="pt-6 lg:pt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@havenzonee4.org"
                    defaultValue="admin@havenzonee4.org"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" defaultValue="••••••••••" required />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>
              <div className="mt-5 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                Prototype build — any credentials will sign you in.
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Haven Zone E4 &middot; Powered by Christ Embassy
          </p>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <Icon className="h-4 w-4 text-primary-foreground/70 mb-2" />
      <p className="text-xl font-semibold leading-none">{value}</p>
      <p className="text-[11px] text-primary-foreground/70 mt-1">{label}</p>
    </div>
  );
}
