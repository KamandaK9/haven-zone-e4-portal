"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getCheckInLink } from "@/lib/actions/check-in";
import { serviceKeyString, type ServiceKey } from "@/lib/check-in/types";
import { remember } from "./use-check-in";

// The service's QR check-in link as an SVG, for the kiosk. Fetched while
// online and remembered on the device, so the code still shows offline.
export function useQrLink(key: ServiceKey, enabled: boolean): { url?: string; svg?: string } {
  const storeKey = `qr:${serviceKeyString(key)}`;
  const [url, setUrl] = useState<string | undefined>(() => remember(storeKey));
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    if (!enabled || !navigator.onLine) return;
    let cancelled = false;
    getCheckInLink(key)
      .then((res) => {
        if (cancelled || !res.ok) return;
        remember(storeKey, res.url);
        setUrl(res.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, key, storeKey]);

  useEffect(() => {
    if (!url) return;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } })
      .then(setSvg)
      .catch(() => setSvg(undefined));
  }, [url]);

  return { url, svg };
}
