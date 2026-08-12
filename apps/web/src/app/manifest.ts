import type { MetadataRoute } from "next";

import { siteConfig } from "~/config/site";
import { sitePath } from "~/lib/site-path";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#09090b",
    description: siteConfig.description,
    display: "standalone",
    icons: [
      {
        src: sitePath("/icons/beat-192.png"),
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: sitePath("/icons/beat-512.png"),
        sizes: "512x512",
        type: "image/png",
      },
      {
        purpose: "maskable",
        src: sitePath("/icons/beat-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
      },
    ],
    id: sitePath("/"),
    lang: "ko",
    name: siteConfig.name,
    orientation: "any",
    scope: sitePath("/"),
    short_name: siteConfig.shortName,
    start_url: sitePath("/"),
    theme_color: "#09090b",
  };
}
