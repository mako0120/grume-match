import type { Metadata } from "next";
import { DIARY_OG_IMAGE, DIARY_SITE_NAME } from "@/lib/diary/seo";
import "./diary.css";
import "./modern.css";

export const metadata: Metadata = {
  // Own template: diary pages must not inherit the PR OS brand suffix.
  title: {
    default: "グルメ日誌｜大阪グルメ紹介・飲食店のInstagram PR",
    template: "%s",
  },
  robots: {
    index: process.env.DIARY_PUBLIC_INDEX_ENABLED === "true",
    follow: process.env.DIARY_PUBLIC_INDEX_ENABLED === "true",
  },
  description: "大阪グルメを紹介するInstagramアカウント「グルメ日誌」の公式サイト。飲食店さま向けのPR投稿を、来店・撮影・編集・投稿まで担当します。1案件から依頼でき、ご相談・お見積もりは無料です。",
  openGraph: {
    title: "グルメ日誌｜大阪グルメ紹介・飲食店のInstagram PR",
    description: "まだ知らない「おいしい」に、出会うきっかけを。1案件から依頼でき、ご相談は無料です。",
    siteName: DIARY_SITE_NAME,
    locale: "ja_JP",
    type: "website",
    images: [DIARY_OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [DIARY_OG_IMAGE.url] },
  // Google Search Console ownership: paste only the content="…" value.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function DiaryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="diary">{children}</div>;
}
