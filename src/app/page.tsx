import { LoginPage } from "@/components/auth/login-page";
import { getOrgSettings } from "@/lib/org-settings-server";

export default async function LandingPage() {
  const { login } = await getOrgSettings();
  return <LoginPage headline={login.headline} blurb={login.blurb} />;
}
