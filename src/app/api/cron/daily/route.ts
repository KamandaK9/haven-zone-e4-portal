import { timingSafeEqual } from "node:crypto";
import { runDailyAutomations } from "@/lib/messaging/automations";

// Runs once a day — scheduled by vercel.json (crons) on Vercel, or by the
// scheduler in deploy/docker-compose.example.yml on a server. Both send CRON_SECRET as a
// bearer token; anything else is refused, so this can't be triggered from
// outside.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response("Forbidden", { status: 403 });
  return Response.json(await runDailyAutomations());
}
