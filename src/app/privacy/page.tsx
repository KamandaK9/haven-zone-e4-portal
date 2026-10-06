import type { Metadata } from "next";
import { LegalFrame } from "@/components/legal/legal-frame";
import { PrivacyNotice } from "@/components/legal/privacy-notice";

export const metadata: Metadata = { title: "Privacy notice" };

// Public: anyone can read how their information is handled before signing in.
export default function PrivacyPage() {
  return (
    <LegalFrame title="Privacy notice">
      <PrivacyNotice />
    </LegalFrame>
  );
}
