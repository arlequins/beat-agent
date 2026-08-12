/**
 * Return a path rooted at the configured site URL.
 *
 * GitHub project Pages serves this app below `/beat-agent`, while the SST
 * static site serves it at `/`. Keeping the path derivation in one place
 * prevents raw `/sw.js`, icon, manifest, and fallback links from escaping the
 * project-site prefix.
 */
export function sitePath(
  path: string,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL,
): string {
  const basePath = siteUrl
    ? (() => {
        try {
          return new URL(siteUrl).pathname.replace(/\/$/, "");
        } catch {
          return "";
        }
      })()
    : "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}` || "/";
}
