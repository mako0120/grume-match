import type { MetadataRoute } from "next";

/** Only advertise routes which have passed their respective release gates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const marketplacePublic = process.env.PUBLIC_LAUNCH_ENABLED === "true";
  const diaryPublic = process.env.DIARY_PUBLIC_INDEX_ENABLED === "true";
  if (!marketplacePublic && !diaryPublic) return [];

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!base || !/^https:\/\/[^/?#]+$/.test(base)) return [];

  const routes: Array<[string, "weekly" | "monthly", number]> = [
    ...(diaryPublic
      ? [
          ["/diary", "weekly", 1],
          ["/diary/services", "monthly", 0.8],
          ["/diary/request", "monthly", 0.8],
          ["/diary/policy", "monthly", 0.5],
          ["/legal/privacy", "monthly", 0.3],
          ["/legal/operator", "monthly", 0.3],
        ] as Array<[string, "weekly" | "monthly", number]>
      : []),
    ...(marketplacePublic
      ? [
          ["", "weekly", 1],
          ["/signup", "monthly", 0.8],
          ["/login", "monthly", 0.3],
          ["/legal/terms", "monthly", 0.3],
          ["/legal/privacy", "monthly", 0.3],
          ["/legal/pr-guidelines", "monthly", 0.3],
          ["/legal/operator", "monthly", 0.3],
          ["/support", "monthly", 0.3],
        ] as Array<[string, "weekly" | "monthly", number]>
      : []),
  ];
  return [...new Map(routes.map(([path, frequency, priority]) => [
    path, { url: base + path, changeFrequency: frequency, priority },
  ])).values()];
}
