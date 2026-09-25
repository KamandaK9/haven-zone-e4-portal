import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { hasCompletedZone, isSetupEnabled } from "@/lib/setup-gate";

// Importing a real zone's worth of members (hundreds to low thousands of
// rows) via completeZoneSetup can take longer than the default Server
// Action budget — this raises it for every Server Action called from any
// page in this route segment (Next.js requires this be set at the page or
// layout level, not inside the action file itself).
export const maxDuration = 60;

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Setup creates a brand-new account — an already-authenticated visitor
  // belongs to a zone already and shouldn't re-run it.
  if (user) redirect("/dashboard");

  // One organisation per deployment. completeZoneSetup enforces both of
  // these itself; this just saves someone filling in the whole wizard first.
  if (!isSetupEnabled()) {
    return <SetupClosed message="Setup is disabled on this deployment." />;
  }
  if (await hasCompletedZone()) {
    return <SetupClosed message="Setup is closed — this portal has already been set up." />;
  }

  return <>{children}</>;
}

function SetupClosed({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
          <BrandMark size={44} />
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lock className="h-4 w-4 text-muted-foreground" />
            {message}
          </div>
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
