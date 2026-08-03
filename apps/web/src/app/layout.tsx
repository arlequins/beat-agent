import { ThemeProvider } from "@arlequins/ui/theme";
import { Toaster } from "@arlequins/ui/toast";
import type { Metadata, Viewport } from "next";

import { OidcAuthProvider } from "~/auth/provider";
import { PwaRegistration } from "~/components/pwa-registration";
import { siteConfig } from "~/config/site";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/styles.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.name,
  },
  icons: {
    apple: [{ sizes: "192x192", url: "/icons/beat-192.png" }],
    icon: [
      { sizes: "192x192", type: "image/png", url: "/icons/beat-192.png" },
      { sizes: "512x512", type: "image/png", url: "/icons/beat-512.png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  viewportFit: "cover",
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <ThemeProvider>
          <OidcAuthProvider>
            <TRPCReactProvider>{props.children}</TRPCReactProvider>
          </OidcAuthProvider>
          <Toaster />
          <PwaRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
