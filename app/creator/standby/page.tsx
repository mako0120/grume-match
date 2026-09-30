import Link from "next/link";
import { StandbyToggle } from "@/components/standby-toggle";
import { getCreatorStandbyStatus } from "@/server/queries/standby";

export default async function CreatorStandbyPage() {
  const standby = await getCreatorStandbyStatus();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/creator/campaigns">案件</Link>
          <Link href="/creator/flash">FLASH</Link>
          <Link href="/notifications">通知</Link>
        </nav>
      </header>

      <span className="eyebrow">STANDBY</span>
      <h1 className="page-title">今行ける</h1>
      <p className="page-subtitle">
        急なPR案件に行ける時だけON。場所や細かい条件入力は不要です。
      </p>

      <StandbyToggle
        availableUntil={standby?.availableUntil ?? null}
        initialActive={standby?.active ?? false}
      />

      <section className="section-card standby-info">
        <strong>仕組みはこれだけ</strong>
        <p>
          ONにすると4時間だけ有効です。その間にFLASH案件が公開されると通知が届きます。
          位置情報の常時追跡はしません。
        </p>
      </section>
    </main>
  );
}
