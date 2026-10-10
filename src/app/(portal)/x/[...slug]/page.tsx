import { notFound, redirect } from "next/navigation";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { extensions } from "@/lib/extensions";
import { tenant } from "@/tenant";

// A client's own page (tenant.extensionPages + src/tenant/extensions.ts).
export default async function ExtensionPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const [slug, ...path] = (await params).slug;
  const def = tenant.extensionPages?.find((p) => p.slug === slug);
  const Page = extensions.pages?.[slug];
  if (!def || !Page) notFound();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const caps = def.cap === undefined ? [] : typeof def.cap === "string" ? [def.cap] : def.cap;
  if (caps.length > 0 && !caps.some((c) => can(profile, c))) redirect("/dashboard");
  return <>{await Page({ profile, path })}</>;
}
