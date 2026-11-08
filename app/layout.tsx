import type { Metadata } from "next";
import "./globals.css";
import "./diary/identity/identity-callback.css";
import { DiaryIdentityCallback } from "./diary/identity/identity-callback";

const publicLaunch = process.env.PUBLIC_LAUNCH_ENABLED === "true";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "GOURMET DIARY PR OS",
    template: "%s | GOURMET DIARY PR OS",
  },
  description: "飲食店とグルメクリエイターを有償PRでつなぐプラットフォーム",
  robots: {
    index: publicLaunch,
    follow: publicLaunch,
  },
  openGraph: {
    title: "GOURMET DIARY PR OS",
    description: "飲食店PRを、DMから解放する。",
    type: "website",
    locale: "ja_JP",
    siteName: "GOURMET DIARY PR OS",
    url: siteUrl || undefined,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{process.env.DIARY_SITE_MODE === "true" ? <DiaryIdentityCallback>{children}</DiaryIdentityCallback> : children}</body>
    </html>
  );
}
