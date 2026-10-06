import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { tenant } from "@/tenant";

// Plain page frame for the public legal pages (no sign-in needed).
export function LegalFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={32} />
          <span className="text-sm font-semibold">{tenant.portalName}</span>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
        <nav className="flex gap-4 border-t pt-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacy notice</Link>
          <Link href="/terms" className="hover:text-foreground">Terms of use</Link>
          <Link href="/my-data" className="hover:text-foreground">Your data</Link>
        </nav>
      </div>
    </div>
  );
}
