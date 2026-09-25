import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RECORDS_BUCKET } from "@/lib/records/files";
import { signedReadUrls } from "@/lib/storage/private-files";

// Opens a cheque's stub scan, for whoever may see the cheque (see
// ../../../files/[fileId]/route.ts).
export async function GET(_request: Request, { params }: { params: Promise<{ chequeId: string }> }) {
  const { chequeId } = await params;
  const supabase = await createClient();
  const { data: cheque } = await supabase.from("cheques").select("stub_path").eq("id", chequeId).maybeSingle();
  if (!cheque?.stub_path) return new Response("Not found.", { status: 404 });

  const url = (await signedReadUrls(RECORDS_BUCKET, [cheque.stub_path])).get(cheque.stub_path);
  if (!url) return new Response("That file is missing from storage.", { status: 404 });
  redirect(url);
}
