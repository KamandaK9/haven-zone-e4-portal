// Shared by the Help dialog and the support inbox.
import type { SupportCategory } from "@/lib/supabase/types";

export const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: "question", label: "I have a question" },
  { value: "problem", label: "Something isn't working" },
  { value: "account", label: "Signing in or my account" },
  { value: "records", label: "My details, giving or training" },
  { value: "other", label: "Something else" },
];

export function supportCategoryLabel(value: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
