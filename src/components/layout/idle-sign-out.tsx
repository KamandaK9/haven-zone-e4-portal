"use client";

import { useEffect } from "react";
import { registerIdleLimit, signOutForInactivity } from "@/lib/actions/session";
import { ACTIVITY_STORAGE_KEY } from "@/lib/idle";

const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
const CHECK_EVERY_MS = 30_000;

function readLast(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
}

function markActive() {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now()));
  } catch {
    // private mode etc. — the server-side check still applies
  }
}

// Signs this browser out after `minutes` without any activity in any of its
// tabs. The proxy enforces the same limit server-side for sessions left with
// no page open (see registerIdleLimit).
export function IdleSignOut({ minutes }: { minutes: number }) {
  useEffect(() => {
    void registerIdleLimit();
    markActive();
    let lastWrite = 0;
    const onActivity = () => {
      // Throttled: one write every few seconds is plenty.
      if (Date.now() - lastWrite > 5000) {
        lastWrite = Date.now();
        markActive();
      }
    };
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
    const timer = setInterval(() => {
      if (Date.now() - readLast() > minutes * 60_000) void signOutForInactivity();
    }, CHECK_EVERY_MS);
    return () => {
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
      clearInterval(timer);
    };
  }, [minutes]);
  return null;
}
