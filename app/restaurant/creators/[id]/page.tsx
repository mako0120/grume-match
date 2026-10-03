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
          <Link
            className="primary-button media-kit-cta"
            href={`/restaurant/offers/new?creator=${kit.id}`}
          >
            この人に指名オファーを送る
          </Link>
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
