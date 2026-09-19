import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  return <>{children}</>;
}
