import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RECORDS_BUCKET } from "@/lib/records/files";
import { signedReadUrls } from "@/lib/storage/private-files";

// Opens a filed document. The row is read under the caller's RLS (which
// follows the record's own permission), and only then is a short-lived
// signed link issued — the bucket itself is private.
export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const supabase = await createClient();
  const { data: file } = await supabase.from("chapter_record_files").select("storage_path").eq("id", fileId).maybeSingle();
  if (!file) return new Response("Not found.", { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const url = (await signedReadUrls(RECORDS_BUCKET, [file.storage_path], download)).get(file.storage_path);
  if (!url) return new Response("That file is missing from storage.", { status: 404 });
  redirect(url);
}
