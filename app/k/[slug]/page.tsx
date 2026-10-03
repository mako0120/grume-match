import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaKitView } from "@/components/media-kit-view";
import { getPublicMediaKit } from "@/server/queries/performance";

export const dynamic = "force-dynamic";

// Shared in DMs/LINE: the preview carries the headline numbers.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const kit = /^[a-z0-9][a-z0-9-]{2,29}$/i.test(slug) ? await getPublicMediaKit(slug) : null;
  const robots = { index: false, follow: false };

  if (!kit) return { title: "メディアキット｜GOURMET DIARY", robots };

  const title = kit.summary
    ? `${kit.displayName}｜${kit.summary.highlights[0]}`
    : `${kit.displayName}｜メディアキット`;
  const description = kit.summary
    ? kit.summary.highlights.slice(1, 4).join("・")
    : `${kit.baseArea}のグルメクリエイター`;

  return {
    title,
    description,
    robots,
    openGraph: { title, description, type: "profile", siteName: "GOURMET DIARY" },
  };
}

export default async function PublicMediaKitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/i.test(slug)) notFound();

  const kit = await getPublicMediaKit(slug);
  if (!kit) notFound();

  return (
    <main className="creator-shell media-kit-page">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">MEDIA KIT</span>
      </header>

      <MediaKitView
        accounts={kit.accounts}
        actions={
          <section className="media-kit-contact">
            <strong>{kit.displayName}にPRを依頼する</strong>
            <p>
              GOURMET DIARYに店舗登録（無料）すると、報酬・提供内容・候補日時を決めて指名オファーを送れます。日程調整や投稿確認、報酬管理までDMなしで進みます。
            </p>
            <Link className="primary-button" href="/signup">
              店舗として登録して依頼する
            </Link>
          </section>
        }
        baseArea={kit.baseArea}
        bio={kit.bio}
        displayName={kit.displayName}
        minReward={kit.minReward}
        summary={kit.summary}
      />
    </main>
  );
}
