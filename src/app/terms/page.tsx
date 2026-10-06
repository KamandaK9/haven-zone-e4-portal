import type { Metadata } from "next";
import { LegalFrame } from "@/components/legal/legal-frame";
import { TermsOfUse } from "@/components/legal/terms";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <LegalFrame title="Terms of use">
      <TermsOfUse />
    </LegalFrame>
  );
}
