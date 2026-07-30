import type { MetadataRoute } from "next";

import { siteConfig } from "~/config/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#09090b",
    description: siteConfig.description,
    display: "standalone",
    icons: [
      {
        src: "/icons/beat-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/beat-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        purpose: "maskable",
        src: "/icons/beat-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    id: "/",
    lang: "ko",
    name: siteConfig.name,
    orientation: "any",
    scope: "/",
    short_name: siteConfig.shortName,
    start_url: "/",
    theme_color: "#09090b",
  };
}
