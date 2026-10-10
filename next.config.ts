import type { NextConfig } from "next";
import path from "path";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

// Event pictures live in Supabase Storage; next/image only optimises images
// from hosts it has been told about.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // A self-contained server for running in a container on any host (see
  // Dockerfile and deploy/README.md). Vercel builds don't need it.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  async headers() {
    return [
      { source: "/:path*", headers: STATIC_SECURITY_HEADERS },
      // The check-in service worker must never be served stale, or a fix to
      // it would take a device's cache lifetime to arrive.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
