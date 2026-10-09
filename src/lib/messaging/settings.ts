import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MessagingSettings = {
  monthlySmsCap: number;
  smsCostEstimate: number;
  smsFooter: string;
  birthdayEnabled: boolean;
  welcomeEnabled: boolean;
  missedEnabled: boolean;
  digestEnabled: boolean;
  birthdayTemplate: string;
  birthdayGuardianTemplate: string;
  welcomeTemplate: string;
  missedTemplate: string;
};

// Used until the church writes its own (Settings → Messaging).
export const DEFAULT_TEMPLATES = {
  birthday: "Happy birthday, {first_name}! 🎂 Everyone at {church} is celebrating you today. May this year be your most blessed yet.",
  birthdayGuardian: "Hi {guardian_name}, wishing {first_name} a very happy birthday from all of us at {church}. God bless your family!",
  welcome: "Hi {first_name}, welcome to {church}! We were so glad to have you with us. We'd love to see you again — and to hear from you any time.",
  missed: "Hi {first_name}, we missed you at {church} on Sunday. We're thinking of you — let us know if there's anything we can pray with you about.",
};

export const DEFAULT_SETTINGS: MessagingSettings = {
  monthlySmsCap: 1500,
  smsCostEstimate: 0.06,
  smsFooter: "Reply STOP to opt out.",
  birthdayEnabled: false,
  welcomeEnabled: false,
  missedEnabled: false,
  digestEnabled: false,
  birthdayTemplate: DEFAULT_TEMPLATES.birthday,
  birthdayGuardianTemplate: DEFAULT_TEMPLATES.birthdayGuardian,
  welcomeTemplate: DEFAULT_TEMPLATES.welcome,
  missedTemplate: DEFAULT_TEMPLATES.missed,
};

export async function getMessagingSettings(zoneId: string): Promise<MessagingSettings> {
  const { data } = await createAdminClient().from("messaging_settings").select("*").eq("zone_id", zoneId).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    monthlySmsCap: data.monthly_sms_cap,
    smsCostEstimate: Number(data.sms_cost_estimate),
    smsFooter: data.sms_footer,
    birthdayEnabled: data.birthday_enabled,
    welcomeEnabled: data.welcome_enabled,
    missedEnabled: data.missed_enabled,
    digestEnabled: data.digest_enabled,
    birthdayTemplate: data.birthday_template?.trim() || DEFAULT_TEMPLATES.birthday,
    birthdayGuardianTemplate: data.birthday_guardian_template?.trim() || DEFAULT_TEMPLATES.birthdayGuardian,
    welcomeTemplate: data.welcome_template?.trim() || DEFAULT_TEMPLATES.welcome,
    missedTemplate: data.missed_template?.trim() || DEFAULT_TEMPLATES.missed,
  };
}

export type Usage = { segments: number; messages: number; cap: number; remaining: number; estimatedCost: number };

// Texts sent this calendar month (UTC), against the cap.
export async function getSmsUsage(zoneId: string, settings?: MessagingSettings): Promise<Usage> {
  const s = settings ?? (await getMessagingSettings(zoneId));
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data } = await createAdminClient()
    .from("message_recipients")
    .select("segments")
    .eq("zone_id", zoneId)
    .eq("channel", "sms")
    .eq("status", "sent")
    .gte("sent_at", monthStart)
    .limit(100000);
  const rows = data ?? [];
  const segments = rows.reduce((n, r) => n + r.segments, 0);
  return { segments, messages: rows.length, cap: s.monthlySmsCap, remaining: Math.max(0, s.monthlySmsCap - segments), estimatedCost: segments * s.smsCostEstimate };
}
