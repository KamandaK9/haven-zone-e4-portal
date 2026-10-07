import type { MetadataRoute } from "next";
import { tenant } from "@/tenant";

// Makes the portal installable ("Add to Home Screen"), opening on check-in —
// the screen used at the door, which also works offline (public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: tenant.portalName,
    short_name: tenant.name,
    description: tenant.description,
    start_url: "/check-in",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
