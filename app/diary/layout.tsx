import type { Metadata } from "next";
import "./diary.css";
import "./modern.css";
import "./retainers.css";

export const metadata: Metadata = {
  title: "グルメ日誌｜大阪 — お店のPR・撮影のご依頼",
  robots: {
    index: process.env.DIARY_PUBLIC_INDEX_ENABLED === "true",
    follow: process.env.DIARY_PUBLIC_INDEX_ENABLED === "true",
  },
  description: "まだ知らない「おいしい」に、出会うきっかけを。大阪のグルメアカウント「グルメ日誌｜大阪」に直接PR・撮影を相談できます。",
  openGraph: {
    title: "グルメ日誌｜大阪 | PRのご依頼",
    description: "お店と次のお客様をつなぐ、大阪のグルメPR。",
    locale: "ja_JP",
    type: "website",
  },
};

export default function DiaryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="diary">{children}</div>;
}
