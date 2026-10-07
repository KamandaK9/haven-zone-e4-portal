/* eslint-disable @next/next/no-img-element -- signed, short-lived storage URLs */
import { redirect } from "next/navigation";
import { Download, FileText, ImageIcon, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadResourceDialog } from "@/components/resources/upload-dialog";
import { GuidelinesEditor } from "@/components/resources/guidelines-editor";
import { DeleteResourceButton } from "@/components/resources/delete-button";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { createClient } from "@/lib/supabase/server";
import { signedReadUrls } from "@/lib/storage/private-files";
import { RESOURCES_BUCKET } from "@/lib/resources/bucket";
import { bestLogo, isLowRes, isVector } from "@/lib/resources/best-logo";
import { DEFAULT_LOGO_GUIDELINES } from "@/lib/resources/guidelines";
import { requireModule } from "@/lib/require-module";
import { tenant } from "@/tenant";

export const metadata = { title: "Resources" };

const sizeLabel = (bytes: number) => (bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);
const formatOf = (r: { file_name: string }) => r.file_name.split(".").pop()?.toUpperCase() ?? "";

export default async function ResourcesPage() {
  await requireModule("resources");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const isAdmin = can(profile, "manage_access");

  const supabase = await createClient();
  const [{ data: rows }, { data: settings }] = await Promise.all([
    supabase.from("resources").select("*").order("created_at", { ascending: false }),
    supabase.from("resource_settings").select("logo_guidelines").maybeSingle(),
  ]);
  const all = rows ?? [];
  const logos = all.filter((r) => r.kind === "logo");
  const best = bestLogo(logos.map((r) => ({ ...r, fileName: r.file_name, createdAt: r.created_at })));
  const others = logos.filter((r) => r.id !== best?.id);
  const brand = all.filter((r) => r.kind === "brand");
  const press = all.filter((r) => r.kind === "press");

  // Signed links (5 minutes): downloads for everything offered, plus a preview of the logo.
  const offered = [...(best ? [best] : []), ...brand, ...press, ...(isAdmin ? others : [])];
  const downloads = await signedReadUrls(RESOURCES_BUCKET, offered.map((r) => r.file_path), true);
  const preview = best && best.mime.startsWith("image/") ? (await signedReadUrls(RESOURCES_BUCKET, [best.file_path])).get(best.file_path) : undefined;
  const guidelines = settings?.logo_guidelines || DEFAULT_LOGO_GUIDELINES;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
          <p className="text-sm text-muted-foreground">{tenant.name}&apos;s logo, brand assets and press releases — always use these copies.</p>
        </div>
        {isAdmin && <UploadResourceDialog />}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Logo
            </CardTitle>
            <CardDescription>Only the highest-quality version is offered here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!best ? (
              <p className="text-sm text-muted-foreground">
                No logo uploaded yet.{isAdmin ? " Upload the original file — SVG, PDF or EPS is best." : ""}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-center rounded-xl border bg-muted/30 p-6">
                  {preview ? (
                    <img src={preview} alt={best.title} className="max-h-48 w-auto object-contain" />
                  ) : (
                    <p className="text-sm text-muted-foreground">{formatOf(best)} file — download to view</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium">{best.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {isVector({ mime: best.mime, fileName: best.file_name })
                        ? `${formatOf(best)} · vector, any size`
                        : `${best.width}×${best.height} px · ${formatOf(best)}`}{" "}
                      · {sizeLabel(best.bytes)}
                    </p>
                  </div>
                  {downloads.get(best.file_path) && (
                    <Button asChild className="gap-2">
                      <a href={downloads.get(best.file_path)}>
                        <Download className="h-4 w-4" /> Download logo
                      </a>
                    </Button>
                  )}
                </div>
                {isLowRes({ ...best, fileName: best.file_name, createdAt: best.created_at }) && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    This logo is low resolution — fine on screen, too small for print. Upload a larger original when you have it.
                  </p>
                )}
              </>
            )}
            {isAdmin && others.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  {others.length} other logo file{others.length === 1 ? "" : "s"} — hidden from leaders because a better one exists
                </summary>
                <ul className="mt-2 space-y-1">
                  {others.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                      <span>
                        {r.title} · {r.width ? `${r.width}×${r.height} px` : formatOf(r)}
                      </span>
                      <DeleteResourceButton id={r.id} title={r.title} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {isAdmin && best && (
              <div className="flex justify-end">
                <DeleteResourceButton id={best.id} title={best.title} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Using the logo</CardTitle>
            <CardDescription>Please follow these whenever the logo is used</CardDescription>
          </CardHeader>
          <CardContent>
            <GuidelinesEditor text={guidelines} editable={isAdmin} />
          </CardContent>
        </Card>
      </div>

      <FileList
        title="Brand assets"
        description="Photos, banners, templates and other approved material"
        icon={<FileText className="h-4 w-4" />}
        items={brand}
        downloads={downloads}
        isAdmin={isAdmin}
      />
      <FileList
        title="Press releases"
        description="Official statements, newest first"
        icon={<Newspaper className="h-4 w-4" />}
        items={press}
        downloads={downloads}
        isAdmin={isAdmin}
      />
    </div>
  );
}

function FileList({
  title,
  description,
  icon,
  items,
  downloads,
  isAdmin,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  items: { id: string; title: string; description: string | null; file_name: string; file_path: string; bytes: number; created_at: string }[];
  downloads: Map<string, string>;
  isAdmin: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="rounded-xl border divide-y">
            {items.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    {r.title} <Badge variant="secondary">{formatOf(r)}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[r.description, new Date(r.created_at).toLocaleDateString("en-ZA"), sizeLabel(r.bytes)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {downloads.get(r.file_path) && (
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a href={downloads.get(r.file_path)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </Button>
                  )}
                  {isAdmin && <DeleteResourceButton id={r.id} title={r.title} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
