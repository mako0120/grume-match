import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const privateHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Netlify's UI contains a non-secret, production-scoped flag.
  // Compile its boolean into the Next.js build so the native Forms UI
  // cannot silently fall back to Instagram DM if the SSR adapter omits
  // an environment variable at function runtime.
  // Both flag and production deploy context must match; previews stay off.
  env: {
    // Keep published-diary legal pages and their route-mode decision aligned
    // with the build, even if SSR function runtime omits context variables.
    DIARY_SITE_MODE: process.env.CONTEXT === "production" &&
      process.env.DIARY_SITE_MODE === "true" ? "true" : "false",
    DIARY_NETLIFY_FORMS_ENABLED:
      process.env.CONTEXT === "production" &&
      process.env.DIARY_NETLIFY_FORMS_ENABLED === "true"
        ? "true"
        : "false",
  },
  async redirects() {
    // Only for the separate Netlify diary production site, never for the PR OS.
    return process.env.DIARY_SITE_MODE === "true"
      ? [{ source: "/", destination: "/diary", permanent: false }]
      : [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/diary/confirm/:path*",
        headers: [
          ...privateHeaders,
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/diary/confirmed",
        headers: privateHeaders,
      },
      {
        // Browser-only CSV workspace: no PII may be cached by proxies or browsers.
        source: "/diary/ops/:path*",
        headers: [
          ...privateHeaders,
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Content-Security-Policy", value: "base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; connect-src 'self'; img-src 'self' data:" },
        ],
      },
      ...[
        "/creator/:path*",
        "/restaurant/:path*",
        "/admin/:path*",
        "/account",
        "/notifications",
        "/onboarding",
        "/legal/accept",
      ].map((source) => ({
        source,
        headers: privateHeaders,
      })),
    ];
  },
};

export default nextConfig;
