import type { MetadataRoute } from "next";

/**
 * Direct グルメ日誌 PR requests and the multi-tenant PR marketplace have
 * independent go-live decisions. Never open marketplace URLs just to make
 * the first-party diary discoverable.
 */
export default function robots(): MetadataRoute.Robots {
  const marketplacePublic = process.env.PUBLIC_LAUNCH_ENABLED === "true";
  const diaryPublic = process.env.DIARY_PUBLIC_INDEX_ENABLED === "true";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (!marketplacePublic && !diaryPublic) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  if (!marketplacePublic) {
    return {
      rules: {
        userAgent: "*",
        // These public PR information routes can be indexed independently.
        allow: ["/diary", "/legal/privacy", "/legal/operator"],
        // Longest-path match prevents private case pages being indexed even
        // though they live under the public /diary prefix.
        disallow: [
          "/", "/diary/ops", "/diary/confirm/", "/diary/confirmed",
          "/diary/thanks",
        ],
      },
      sitemap: siteUrl ? siteUrl + "/sitemap.xml" : undefined,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/", "/diary/ops", "/diary/confirm/", "/diary/confirmed",
        "/diary/thanks", "/creator/", "/restaurant/", "/account",
        "/notifications", "/onboarding",
      ],
    },
    sitemap: siteUrl ? siteUrl + "/sitemap.xml" : undefined,
  };
}
