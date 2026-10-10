import "server-only";
import { getOrgSettings } from "@/lib/org-settings-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailIsConfigured, sendEmailOne } from "@/lib/email";
import { getAttendanceData, churchToday } from "@/lib/data/attendance";
import { summarise } from "@/lib/attendance/summary";
import { getSiteUrl } from "@/lib/site-url";
import { tenant } from "@/tenant";
import { dispatchMessage } from "./dispatch";
import { buildRecipients, type MemberForMessage, type Recipient } from "./recipients";
import { getMessagingSettings } from "./settings";
import { birthdayMonthDay } from "./text";

// The things the church's messaging does on its own, run once a day (see
// src/app/api/cron/daily). Each is off until someone turns it on in
// Settings → Messaging, and each message is recorded like any other.

type Admin = ReturnType<typeof createAdminClient>;
const COLUMNS = "id, first_name, last_name, email, phone, age_group, guardian_name, guardian_phone, messaging_opt_out";
const DAY = 86_400_000;

async function allMembers(admin: Admin, extra = ""): Promise<(MemberForMessage & Record<string, unknown>)[]> {
  const out: (MemberForMessage & Record<string, unknown>)[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from("members").select(`${COLUMNS}${extra}`).order("id").range(from, from + 999);
    if (!data) break;
    out.push(...(data as unknown as (MemberForMessage & Record<string, unknown>)[]));
    if (data.length < 1000) break;
  }
  return out;
}

async function writeMessage(
  admin: Admin,
  zoneId: string,
  kind: "birthday" | "welcome" | "missed",
  body: string,
  recipients: Recipient[],
  opts: { status: "pending" | "approved"; batchDate?: string }
): Promise<string | null> {
  const { data: message, error } = await admin
    .from("messages")
    .insert({
      zone_id: zoneId,
      kind,
      channel: "sms",
      body,
      status: opts.status,
      batch_date: opts.batchDate ?? null,
      ...(opts.status === "approved" ? { approved_by_name: "Automatic", approved_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();
  if (error || !message) return null; // e.g. today's birthday batch already exists
  for (let i = 0; i < recipients.length; i += 500) {
    await admin.from("message_recipients").insert(
      recipients.slice(i, i + 500).map((r) => ({
        message_id: message.id,
        zone_id: zoneId,
        member_id: r.memberId,
        channel: "sms" as const,
        name: r.name,
        to_address: r.to,
        via: r.via,
        body: r.body,
        segments: r.segments,
      }))
    );
  }
  return message.id;
}

export async function runDailyAutomations(): Promise<Record<string, unknown>> {
  const admin = createAdminClient();
  const { data: zone } = await admin.from("zones").select("id").limit(1).maybeSingle();
  if (!zone) return { skipped: "no zone yet" };
  const zoneId = zone.id;
  const settings = await getMessagingSettings(zoneId);
  const today = churchToday();
  const result: Record<string, unknown> = { today };

  // Housekeeping: a send that died mid-way is put back; a birthday batch
  // nobody approved by the end of its day is dropped.
  const stale = new Date(Date.now() - 15 * 60_000).toISOString();
  await admin.from("messages").update({ status: "approved" }).eq("zone_id", zoneId).eq("status", "sending").lt("approved_at", stale);
  await admin.from("messages").update({ status: "cancelled", note: "Not approved in time." }).eq("zone_id", zoneId).eq("kind", "birthday").eq("status", "pending").lt("batch_date", today);

  // Birthdays → a batch that waits for approval.
  if (settings.birthdayEnabled) {
    const [, month, day] = today.split("-").map(Number);
    const members = (await allMembers(admin, ", birthday")).filter((m) => {
      const b = birthdayMonthDay(m.birthday as string | null);
      return b && b.month === month && b.day === day;
    });
    const { recipients } = buildRecipients(members, "sms", { self: settings.birthdayTemplate, guardian: settings.birthdayGuardianTemplate }, { footer: settings.smsFooter });
    result.birthdays = recipients.length;
    if (recipients.length > 0) await writeMessage(admin, zoneId, "birthday", settings.birthdayTemplate, recipients, { status: "pending", batchDate: today });
  }

  // First-timers → a welcome, once.
  if (settings.welcomeEnabled) {
    const since = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10);
    const { data: visitors } = await admin.from("members").select(COLUMNS).eq("is_visitor", true).gte("join_date", since);
    const { data: welcomed } = await admin.from("messages").select("id").eq("zone_id", zoneId).eq("kind", "welcome").limit(5000);
    const { data: already } = welcomed?.length
      ? await admin.from("message_recipients").select("member_id").in("message_id", welcomed.map((m) => m.id)).limit(50000)
      : { data: [] };
    const done = new Set((already ?? []).map((r) => r.member_id));
    const fresh = (visitors ?? []).filter((v) => !done.has(v.id));
    const { recipients } = buildRecipients(fresh, "sms", { self: settings.welcomeTemplate }, { footer: settings.smsFooter });
    result.welcomes = recipients.length;
    if (recipients.length > 0) {
      const id = await writeMessage(admin, zoneId, "welcome", settings.welcomeTemplate, recipients, { status: "approved" });
      if (id) await dispatchMessage(id);
    }
  }

  // Two Sundays missed → one kind note per absence (and not if a leader has
  // already been in touch).
  if (settings.missedEnabled) {
    const data = await getAttendanceData(12, admin);
    if (data.available) {
      const latestSunday = data.services.filter((s) => s.kind === "sunday").map((s) => s.date).sort().at(-1);
      // Only act on fresh data: if nobody's been checking people in, say nothing.
      if (latestSunday && Date.parse(today) - Date.parse(latestSunday) <= 10 * DAY) {
        const members = (await allMembers(admin, ", church_id, is_visitor")).filter((m) => !m.is_visitor);
        const rules = (await getOrgSettings(zoneId)).attendance;
        const standing = summarise(members.map((m) => ({ id: m.id, churchId: m.church_id as string })), data.services, data.attendance, today, rules);
        const { data: sentBefore } = await admin.from("messages").select("id").eq("zone_id", zoneId).eq("kind", "missed").limit(5000);
        const { data: prior } = sentBefore?.length
          ? await admin.from("message_recipients").select("member_id, sent_at").in("message_id", sentBefore.map((m) => m.id)).not("sent_at", "is", null).limit(50000)
          : { data: [] };
        const lastMessaged = new Map<string, string>();
        for (const p of prior ?? []) if (p.member_id && (lastMessaged.get(p.member_id) ?? "") < p.sent_at!) lastMessaged.set(p.member_id, p.sent_at!);
        const recent = new Set(data.followUps.filter((f) => f.createdAt >= new Date(Date.now() - 14 * DAY).toISOString()).map((f) => f.memberId));
        const due = members.filter((m) => {
          const s = standing.get(m.id);
          if (!s || s.missedInARow < rules.absenceAlertAfter || recent.has(m.id)) return false;
          const last = lastMessaged.get(m.id);
          return !last || (!!s.lastAttended && last.slice(0, 10) < s.lastAttended);
        });
        const { recipients } = buildRecipients(due, "sms", { self: settings.missedTemplate }, { footer: settings.smsFooter });
        result.missed = recipients.length;
        if (recipients.length > 0) {
          const id = await writeMessage(admin, zoneId, "missed", settings.missedTemplate, recipients, { status: "approved" });
          if (id) await dispatchMessage(id);
        }
      }
    }
  }

  // Monday summary for pastors.
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tenant.timezone, weekday: "short" }).format(new Date());
  if (settings.digestEnabled && weekday === "Mon" && emailIsConfigured()) result.digests = await sendMondayDigests(admin, zoneId, today);

  // Anything approved that couldn't go earlier (keys added since, a new month).
  const { data: waiting } = await admin.from("messages").select("id").eq("zone_id", zoneId).eq("status", "approved").limit(20);
  let retried = 0;
  for (const m of waiting ?? []) if ((await dispatchMessage(m.id)).ok) retried++;
  result.retried = retried;
  return result;
}

async function sendMondayDigests(admin: Admin, zoneId: string, today: string): Promise<number> {
  const data = await getAttendanceData(12, admin);
  if (!data.available) return 0;
  const members = (await allMembers(admin, ", church_id, is_visitor, join_date")) as (MemberForMessage & { church_id: string; is_visitor: boolean; join_date: string | null })[];
  const regulars = members.filter((m) => !m.is_visitor);
  const rules = (await getOrgSettings(zoneId)).attendance;
  const standing = summarise(regulars.map((m) => ({ id: m.id, churchId: m.church_id })), data.services, data.attendance, today, rules);
  const { data: churches } = await admin.from("churches").select("id, name");
  const churchName = new Map((churches ?? []).map((c) => [c.id, c.name]));
  const { data: leaders } = await admin.from("profiles").select("full_name, email, scope, church_id, caps").eq("zone_id", zoneId).in("scope", ["zone", "chapter"]);
  const site = await getSiteUrl();
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
  let sent = 0;

  for (const leader of leaders ?? []) {
    if (!leader.email || !(leader.caps ?? []).includes("view_reports")) continue;
    const inScope = (churchId: string) => leader.scope === "zone" || churchId === leader.church_id;
    const sundays = data.services.filter((s) => s.kind === "sunday" && inScope(s.churchId));
    const lastDate = sundays.map((s) => s.date).sort().at(-1);
    const lastCount = lastDate ? sundays.filter((s) => s.date === lastDate).reduce((n, s) => n + s.attendees, 0) : 0;
    const mine = regulars.filter((m) => inScope(m.church_id));
    const active = mine.filter((m) => standing.get(m.id)?.status === "active").length;
    const followUp = mine.filter((m) => (standing.get(m.id)?.missedInARow ?? 0) >= rules.absenceAlertAfter).length;
    const firstTimers = members.filter((m) => m.is_visitor && inScope(m.church_id) && (m.join_date ?? "") >= weekAgo).length;
    const area = leader.scope === "zone" ? tenant.name : (churchName.get(leader.church_id ?? "") ?? tenant.name);
    const lines = [
      `Good morning ${leader.full_name.split(" ")[0]},`,
      "",
      `Here's ${area} for the week:`,
      lastDate ? `• Last Sunday (${lastDate}): ${lastCount} checked in` : "• No Sunday services have been checked in yet",
      `• Active members: ${active} of ${mine.length}`,
      `• New first-timers this week: ${firstTimers}`,
      `• Waiting for a follow-up: ${followUp}`,
      "",
      `Open the portal: ${site}/attendance`,
    ];
    const text = lines.join("\n");
    const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6"><p>Good morning ${leader.full_name.split(" ")[0]},</p><p>Here's <strong>${area}</strong> for the week:</p><ul><li>${lastDate ? `Last Sunday (${lastDate}): <strong>${lastCount}</strong> checked in` : "No Sunday services have been checked in yet"}</li><li>Active members: <strong>${active}</strong> of ${mine.length}</li><li>New first-timers this week: <strong>${firstTimers}</strong></li><li>Waiting for a follow-up: <strong>${followUp}</strong></li></ul><p><a href="${site}/attendance">Open the portal</a></p></div>`;
    const res = await sendEmailOne({ to: leader.email, subject: `${area}: your week`, text, html });
    if (res.ok) sent++;
  }
  return sent;
}
