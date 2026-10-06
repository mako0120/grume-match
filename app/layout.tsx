import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "GOURMET DIARY PR OS",
  description: "飲食店とグルメクリエイターを有償PRでつなぐプラットフォーム",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
