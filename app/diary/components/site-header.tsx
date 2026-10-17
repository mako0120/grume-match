import Link from "next/link";

export function DiaryHeader({ active = "home" }: { active?: "home" | "services" | "request" }) {
  return (
    <>
      <a className="diary-v2-skip" href="#diary-main">本文へスキップ</a>
      <header className="diary-v2-header">
        <div className="diary-v2-header-inner">
          <Link className="diary-v2-brand" href="/diary" aria-label="グルメ日誌｜大阪 トップページ">
            <span className="diary-v2-brand-symbol" aria-hidden="true">食</span>
            <span>グルメ日誌 <small>GOURMET DIARY / OSAKA</small></span>
          </Link>
          <nav className="diary-v2-nav" aria-label="グルメ日誌サイトメニュー">
            <Link href="/diary#work">Instagram実績</Link>
            <Link href="/diary/services" aria-current={active === "services" ? "page" : undefined}>プランと料金</Link>
            <Link href="/diary#flow">ご依頼の流れ</Link>
          </nav>
          <Link className="diary-v2-header-cta" href="/diary/request?intent=consultation" aria-current={active === "request" ? "page" : undefined}>
            無料で相談する <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
    </>
  );
}

export function DiaryMobileCTA() {
  return (
    <aside className="diary-v2-mobile-cta" aria-label="PRのご相談">
      <span><strong>フィード1投稿 8,000円〜</strong><small>相談・見積もり無料</small></span>
      <Link href="/diary/request?intent=consultation">相談する <span aria-hidden="true">↗</span></Link>
    </aside>
  );
}
