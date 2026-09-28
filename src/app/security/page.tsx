import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaEnroll } from "@/components/settings/mfa-enroll";
import { getCurrentProfile } from "@/lib/data/get-dataset";

// Reachable by any signed-in login (staff or member) — MFA is offered to
// everyone, even though it's specifically expected of admin accounts.
// Standalone rather than under (portal)/(member) so it isn't caught by
// either layout's own aal2 redirect (see those layouts) while someone is
// mid-enrollment.
export default async function SecurityPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  const backHref = profile.role === "member" ? "/me" : "/dashboard";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-lg space-y-6">
        <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Two-factor authentication
            </CardTitle>
            <CardDescription>
              Add an authenticator app for a second step at sign-in. Once added, every sign-in on this account needs a
              code from the app as well as your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MfaEnroll />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
