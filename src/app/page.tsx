"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Globe2, Users2, TrendingUp, ArrowRight, AlertCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { tenant } from "@/tenant";

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const isMember = params.get("from") === "member";
  const authError = params.get("authError") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
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
            <p className="font-semibold leading-tight">{tenant.portalName}</p>
            <p className="text-xs text-primary-foreground/70 leading-tight">Member Management</p>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            One view of every chapter, every member, every country in your zone.
          </h1>
          <p className="text-primary-foreground/80 text-[15px] leading-relaxed">
            Track membership growth, PCO, dues and special-project giving, and training
            progress across the zone — from a single dashboard built for
            leadership.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            <StatBlock icon={Users2} label="Members" />
            <StatBlock icon={Globe2} label="Countries" />
            <StatBlock icon={TrendingUp} label="Chapters" />
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          An arm of Christ Embassy
        </p>
      </div>

      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <BrandMark size={44} />
            <div className="text-center">
              <p className="font-semibold">{tenant.portalName}</p>
              <p className="text-xs text-muted-foreground">Member Management</p>
            </div>
          </div>

          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-semibold tracking-tight">{isMember ? "Member sign in" : "Welcome back"}</h2>
            <p className="text-sm text-muted-foreground">
              {isMember
                ? "Sign in to see your profile, giving history, and the calendar."
                : "Sign in to access your zone's dashboard."}
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
                    placeholder={tenant.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              {(error || authError) && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error ?? "That link has expired or was already used. Request a new one below."}
                </div>
              )}

              {!isMember && (
                <div className="mt-5 text-center text-xs text-muted-foreground">
                  Setting up a new zone?{" "}
                  <Link href="/setup" className="text-primary font-medium hover:underline">
                    Start here
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">Powered by Stratum KamTech</p>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <Icon className="h-4 w-4 text-primary-foreground/70 mb-2" />
      <p className="text-[11px] text-primary-foreground/70">{label}</p>
    </div>
  );
}
