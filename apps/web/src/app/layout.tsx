import { ThemeProvider } from "@arlequins/ui/theme";
import { Toaster } from "@arlequins/ui/toast";
import type { Metadata, Viewport } from "next";

import { OidcAuthProvider } from "~/auth/provider";
import { siteConfig } from "~/config/site";
import { env } from "~/env";
import { sitePath } from "~/lib/site-path";
import {
  PwaRegistration,
  PwaUpdateNotice,
} from "~/shared/lib/pwa-registration";
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
    apple: [{ sizes: "192x192", url: sitePath("/icons/beat-192.png") }],
    icon: [
      {
        sizes: "192x192",
        type: "image/png",
        url: sitePath("/icons/beat-192.png"),
      },
      {
        sizes: "512x512",
        type: "image/png",
        url: sitePath("/icons/beat-512.png"),
      },
    ],
  },
  manifest: sitePath("/manifest.webmanifest"),
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  viewportFit: "cover",
};

function securityPolicy() {
  const apiOrigin = new URL(env.NEXT_PUBLIC_API_URL).origin;
  const oidcOrigin = new URL(env.NEXT_PUBLIC_OIDC_AUTHORITY).origin;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https:",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    `connect-src 'self' ${apiOrigin} ${oidcOrigin}`,
    "font-src 'self' data:",
    ...(env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta content={securityPolicy()} httpEquiv="Content-Security-Policy" />
        <meta content="no-referrer" name="referrer" />
      </head>
      <body className="bg-background text-foreground min-h-screen font-sans antialiased">
        <ThemeProvider>
          <OidcAuthProvider>
            <TRPCReactProvider>{props.children}</TRPCReactProvider>
          </OidcAuthProvider>
          <Toaster />
          <PwaRegistration />
          <PwaUpdateNotice />
        </ThemeProvider>
      </body>
    </html>
  );
}
