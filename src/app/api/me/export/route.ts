import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { createClient } from "@/lib/supabase/server";
import { getLegal } from "@/lib/legal-server";
import { getMemberDetailsForExport } from "@/lib/data/member-fields";

// "Download my data": everything the portal holds about the signed-in
// person, as JSON. Read with their own session, so RLS guarantees it's only
// theirs. Records others wrote that merely mention them (e.g. minutes)
// aren't included — those come through an access request.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return new NextResponse("Please sign in.", { status: 401 });
  const supabase = await createClient();

  const { data: login } = await supabase
    .from("profiles")
    .select("full_name, email, phone, role, position, portfolio, scope, created_at, privacy_accepted_version, privacy_accepted_at")
    .eq("id", profile.userId)
    .maybeSingle();
  const { data: member } = await supabase.from("members").select("*").eq("profile_id", profile.userId).maybeSingle();
  const memberId = member?.id;

  const [giving, trainings, lessons, support, requests, chat] = await Promise.all([
    memberId ? supabase.from("giving_entries").select("month, category, amount").eq("member_id", memberId).order("month") : null,
    memberId ? supabase.from("trainings").select("status, assigned_at, completed_at, training_programs(name)").eq("member_id", memberId) : null,
    memberId ? supabase.from("training_lesson_progress").select("completed, completed_at, quiz_score, training_lessons(title)").eq("member_id", memberId) : null,
    supabase.from("support_requests").select("category, message, status, created_at").eq("profile_id", profile.userId),
    supabase.from("data_requests").select("kind, details, status, response, created_at, resolved_at").eq("profile_id", profile.userId),
    supabase.from("live_stream_messages").select("body, created_at, live_streams(title)").eq("profile_id", profile.userId),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    organisation: (await getLegal(profile.zoneId)).organisationName,
    note: "Amounts are in US dollars, as stored. Ask the Information Officer for anything not included here.",
    account: login,
    member: member ? { ...member, photo_path: undefined } : null,
    // The organisation's own details about you that you can see.
    otherDetails: memberId ? await getMemberDetailsForExport(memberId, profile.zoneId) : {},
    giving: giving?.data ?? [],
    training: trainings?.data ?? [],
    lessonProgress: lessons?.data ?? [],
    supportRequests: support.data ?? [],
    privacyRequests: requests.data ?? [],
    chatMessages: chat.data ?? [],
  };
  const filename = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
