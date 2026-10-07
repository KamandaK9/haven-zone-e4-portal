"use client";

import dynamic from "next/dynamic";

// The check-in screen runs only in the browser: everything it works from —
// the saved member list, the queue, online/offline — lives on the device.
export const CheckInLoader = dynamic(() => import("./check-in-app").then((m) => m.CheckInApp), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Opening check-in…</p>,
});
