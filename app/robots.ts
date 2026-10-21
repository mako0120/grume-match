import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const publicLaunch = process.env.PUBLIC_LAUNCH_ENABLED === "true";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (!publicLaunch) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/diary/ops",
        "/creator/",
        "/restaurant/",
        "/account",
        "/notifications",
        "/onboarding",
      ],
    },
    sitemap: siteUrl ? siteUrl + "/sitemap.xml" : undefined,
  };
}
