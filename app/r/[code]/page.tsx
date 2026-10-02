import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SignalLandingActions,
  SignalLandingView,
} from "@/components/signal-landing-actions";
import {
  formatSignalCode,
  isSignalCode,
  normalizeSignalCode,
  SIGNAL_RETENTION_MONTHS,
} from "@/lib/signal-metrics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PR来店のご案内",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Landing = {
  code: string;
  restaurant_name: string;
  area: string;
  address: string;
  phone: string | null;
  reservation_url: string | null;
  category: string;
  creator_name: string;
  post_url: string | null;
};

export default async function SignalLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  if (!isSignalCode(rawCode)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .rpc("get_signal_landing", { p_code: normalizeSignalCode(rawCode) })
    .maybeSingle();

  const landing = data as Landing | null;
  if (!landing) notFound();

  const mapUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${landing.restaurant_name} ${landing.address}`);

  return (
    <main className="creator-shell signal-landing">
      <SignalLandingView code={landing.code} />

      <span className="eyebrow">PR</span>
      <p className="signal-disclosure">
        このページは、{landing.creator_name}さんが店舗から報酬を受けて紹介したPR投稿からのご案内です。
      </p>

      <section className="booking-hero">
        <span className="eyebrow">{landing.area}・{landing.category}</span>
        <h1>{landing.restaurant_name}</h1>
        <p>{landing.address}</p>
      </section>

      <section className="signal-code-card">
        <span>予約・来店時にお伝えください</span>
        <strong>{formatSignalCode(landing.code)}</strong>
        <p>
          スタッフがPRの効果測定に使います。お名前や連絡先が記録されることはありません。
        </p>
      </section>

      <SignalLandingActions
        code={landing.code}
        phone={landing.phone}
        reservationUrl={landing.reservation_url}
      />

      <section className="signal-links">
        <a href={mapUrl} rel="noopener noreferrer" target="_blank">
          地図を開く →
        </a>
        {landing.post_url ? (
          <a href={landing.post_url} rel="noopener noreferrer" target="_blank">
            {landing.creator_name}さんの投稿を見る →
          </a>
        ) : null}
      </section>

      <section className="signal-privacy">
        <strong>計測について</strong>
        <p>
          このページでは、表示回数と「予約する」「電話で予約する」が押された回数だけを記録します。Cookie・IPアドレス・端末情報など、あなたを識別できる情報は保存しません。記録は{SIGNAL_RETENTION_MONTHS}か月後に削除されます。
        </p>
      </section>
    </main>
  );
}
