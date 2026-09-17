"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { readZoneDataSync, useZone } from "@/lib/data/zone-context";

export function SetupGate({ children }: { children: React.ReactNode }) {
  const { data } = useZone();
  const router = useRouter();

  // One-time check on mount, reading localStorage directly rather than
  // trusting the (possibly still-hydrating) reactive `data` value — see
  // readZoneDataSync's doc comment for why that distinction matters here.
  useEffect(() => {
    if (!readZoneDataSync().setupComplete) {
      router.replace("/setup");
    }
  }, [router]);

  if (!data.setupComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <BrandMark size={40} />
          <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
