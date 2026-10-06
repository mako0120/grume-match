import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="規約と表記">
        <Link href="/terms">利用規約</Link>
        <Link href="/privacy">プライバシーポリシー</Link>
        <Link href="/legal">特定商取引法に基づく表記</Link>
      </nav>
      <small>© GOURMET DIARY</small>
    </footer>
  );
}
