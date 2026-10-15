import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.PUBLIC_LAUNCH_ENABLED !== "true") return [];

  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!base) return [];

  return [
    "",
    "/signup",
    "/login",
    "/legal/terms",
    "/legal/privacy",
    "/legal/pr-guidelines",
    "/legal/operator",
    "/support",
  ].map((path) => ({
    url: base + path,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
