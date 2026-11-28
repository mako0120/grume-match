// Search and social metadata for the public グルメ日誌 PR pages.
// Indexing itself stays behind DIARY_PUBLIC_INDEX_ENABLED (app/diary/layout.tsx).

export const DIARY_SITE_NAME = "グルメ日誌｜大阪";
export const DIARY_INSTAGRAM_URL = "https://www.instagram.com/gurunavi_diary/";
export const DIARY_OG_IMAGE = {
  url: "/diary/og.png",
  width: 1200,
  height: 630,
  alt: "グルメ日誌｜大阪 — 大阪の飲食店PR・Instagram撮影。1案件から依頼OK、ご相談・お見積もり無料",
};

/** Absolute https origin, or null when NEXT_PUBLIC_SITE_URL is unset or invalid. */
export function diarySiteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  const origin = value?.replace(/\/+$/, "");
  return origin && /^https:\/\/[^/?#]+$/.test(origin) ? origin : null;
}

/**
 * schema.org data for the top page: who we are and the service we sell.
 * Only facts already shown on the page; no address or rating is invented.
 */
export function diaryStructuredData(origin: string | null, photoFeedPriceYen: number) {
  const at = (path: string) => (origin ? origin + path : undefined);
  const orgId = at("/diary#organization");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        ...(orgId ? { "@id": orgId } : {}),
        name: DIARY_SITE_NAME,
        url: at("/diary"),
        logo: at(DIARY_OG_IMAGE.url),
        sameAs: [DIARY_INSTAGRAM_URL],
        description: "大阪のグルメInstagramアカウント。飲食店のPR投稿を、来店・撮影・編集・投稿まで本人が担当します。",
      },
      {
        "@type": "Service",
        name: "飲食店向けInstagram PR（写真フィード投稿）",
        serviceType: "飲食店のInstagram PR・撮影",
        url: at("/diary/pr"),
        provider: orgId ? { "@id": orgId } : { "@type": "Organization", name: DIARY_SITE_NAME },
        areaServed: { "@type": "AdministrativeArea", name: "大阪府" },
        offers: {
          "@type": "Offer",
          price: photoFeedPriceYen,
          priceCurrency: "JPY",
          description: "Instagramフィード投稿1件・税込。ご相談・お見積もりは無料。",
          url: at("/diary/request"),
        },
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, safe against "</script>". */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
