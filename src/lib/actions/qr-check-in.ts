"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOO_MANY, withinRateLimit } from "@/lib/rate-limit";

// The public QR check-in page's server side. No sign-in: the QR code's
// token is the only key, and every attempt is rate-limited per connection
// before the database is asked anything, so the page can't be used to look
// numbers up in bulk. The database functions only answer the server.

export type QrResult =
  | { status: "checked_in" | "already"; firstName: string }
  | { status: "choose"; choices: { id: string; firstName: string }[] }
  | { status: "not_found" | "expired" | "known_number" | "invalid" }
  | { status: "slow_down"; message: string };

async function caller(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
}

function shape(raw: unknown): QrResult {
  const r = (raw ?? {}) as { status?: string; first_name?: string; choices?: { id: string; first_name: string }[] };
  switch (r.status) {
    case "checked_in":
    case "already":
      return { status: r.status, firstName: r.first_name ?? "" };
    case "choose":
      return { status: "choose", choices: (r.choices ?? []).map((c) => ({ id: c.id, firstName: c.first_name })) };
    case "expired":
    case "known_number":
    case "invalid":
      return { status: r.status };
    default:
      return { status: "not_found" };
  }
}

export async function qrCheckIn(token: string, phone: string, memberId?: string): Promise<QrResult> {
  const who = await caller();
  if (!(await withinRateLimit(`qr:${who}`, 15, 600))) return { status: "slow_down", message: TOO_MANY };
  const { data, error } = await createAdminClient().rpc("qr_check_in", {
    p_token: token.slice(0, 64),
    p_phone: phone.slice(0, 32),
    ...(memberId ? { p_member_id: memberId } : {}),
  });
  return error ? { status: "not_found" } : shape(data);
}

export async function qrAddVisitor(token: string, v: { firstName: string; lastName: string; phone: string }): Promise<QrResult> {
  const who = await caller();
  if (!(await withinRateLimit(`qr-visitor:${who}`, 5, 3600))) return { status: "slow_down", message: TOO_MANY };
  const { data, error } = await createAdminClient().rpc("qr_add_visitor", {
    p_token: token.slice(0, 64),
    p_first_name: v.firstName.slice(0, 80),
    p_last_name: v.lastName.slice(0, 80),
    p_phone: v.phone.slice(0, 32),
  });
  return error ? { status: "invalid" } : shape(data);
}
