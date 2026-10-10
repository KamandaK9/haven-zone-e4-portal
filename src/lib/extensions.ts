import "server-only";
import { after } from "next/server";
// The one sanctioned import of a tenant internal: server-only extension code.
// eslint-disable-next-line no-restricted-imports
import { extensions } from "@/tenant/extensions";
import type { TenantExtensions } from "@/lib/tenant";

export { extensions };

type Hooks = NonNullable<TenantExtensions["hooks"]>;

// Runs a tenant hook once the response has been sent. A failing hook is
// logged; it never affects the action that triggered it.
export function fireHook<K extends keyof Hooks>(name: K, event: Parameters<NonNullable<Hooks[K]>>[0]): void {
  const hook = extensions.hooks?.[name] as ((e: typeof event) => unknown) | undefined;
  if (!hook) return;
  after(async () => {
    try {
      await hook(event);
    } catch (e) {
      console.error(`[extensions] ${String(name)} failed:`, e);
    }
  });
}

// The daily hook, awaited (the cron route reports its outcome).
export async function runDailyExtension(): Promise<unknown> {
  if (!extensions.hooks?.daily) return undefined;
  try {
    return (await extensions.hooks.daily()) ?? "ok";
  } catch (e) {
    console.error("[extensions] daily failed:", e);
    return { error: String(e) };
  }
}
