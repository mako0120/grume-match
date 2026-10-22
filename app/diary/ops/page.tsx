import type { Metadata } from "next";
import { DiaryOpsConsole } from "./components/diary-ops-console";
import "./ops.css";

// This route displays no private data until a local CSV is selected by the owner.
// Do not silently add server-side form-data fetching or embed API keys here.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "PR案件管理｜グルメ日誌（ローカル処理）",
  description: "管理者のブラウザ内でのみCSVを処理するPR案件管理コンソール。",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function DiaryOpsPage() {
  return <DiaryOpsConsole />;
}
