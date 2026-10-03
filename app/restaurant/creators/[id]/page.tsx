import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaKitView } from "@/components/media-kit-view";
import { getCreatorMediaKit } from "@/server/queries/performance";

export default async function RestaurantCreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const kit = await getCreatorMediaKit(id);

  if (!kit) notFound();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← 店舗ホーム
      </Link>

      <MediaKitView
        accounts={kit.accounts}
        actions={
          <>
            {kit.flatPlan ? (
              <Link className="primary-button media-kit-cta" href={`/order/${kit.flatPlan.slug}`}>
                一律¥{kit.flatPlan.price.toLocaleString("ja-JP")}で依頼する
              </Link>
            ) : null}
            <Link
              className={kit.flatPlan ? "secondary-button media-kit-cta" : "primary-button media-kit-cta"}
              href={`/restaurant/offers/new?creator=${kit.id}`}
            >
              条件を決めて指名オファーを送る
            </Link>
          </>
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
