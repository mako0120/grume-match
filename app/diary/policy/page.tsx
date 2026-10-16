import Link from "next/link";

export const metadata = {
  title: "案件受注ポリシー｜グルメ日誌｜大阪",
  description: "グルメ日誌｜大阪では、広告表示を徹底し、対価付き口コミ・高評価の指定・ステルスマーケティングなどの案件は受け付けません。",
};

export default function DiaryPolicyPage() {
  return (
    <main className="diary-form-page">
      <Link className="diary-back" href="/diary">← グルメ日誌へ戻る</Link>
      <div className="diary-form-head">
        <span className="diary-overline">OUR COMMITMENT</span>
        <h1>おいしいを届ける前に、<br /><em>信頼を守る。</em></h1>
        <p>グルメ日誌｜大阪は、法令と各媒体のルールを尊重し、発信者の率直な感想を大切にします。報酬額にかかわらず、下記の禁止条件がある案件は受け付けません。</p>
      </div>
      <article className="diary-inquiry-form" style={{ lineHeight: 2, color: "#41463d" }}>
        <section>
          <h2 style={{ fontSize: 24 }}>お受けできない案件</h2>
          <ul>
            <li><strong>食べログ・Googleマップ等の口コミ投稿を対価や無料提供の条件とする依頼。</strong> Instagram等のPRと「セット」で求められてもお断りします。</li>
            <li>星5・高評価・褒める内容など、評価の内容を指定する依頼。</li>
            <li>広告・PR・提供の関係を隠す投稿（いわゆるステルスマーケティング）。</li>
            <li>実際に食べていない・訪れていないのに、体験したかのように表現させる依頼。</li>
            <li>虚偽・誇大な説明、権利を侵害する素材の無断利用、他媒体の利用規約に反する依頼。</li>
          </ul>
        </section>
        <section>
          <h2 style={{ fontSize: 24 }}>お引き受けできるPR</h2>
          <p>Instagramのフィード・リール・ストーリーズや店舗撮影等について、内容・報酬・投稿時期・広告表記・素材利用範囲を事前に相談し、合意のもとで制作します。</p>
          <p>投稿には必要に応じて「PR」「タイアップ」等、広告関係が読者に明瞭に分かる表示を行います。感想は実体験に基づくもので、特定の評価を保証しません。</p>
        </section>
        <section>
          <h2 style={{ fontSize: 24 }}>受付から制作まで</h2>
          <p>お問い合わせをいただいても、その時点では受注・契約は成立しません。依頼内容を一件ずつ確認し、禁止事項がないか審査します。やり取りの途中で禁止条件が判明した場合も、その条件ではお引き受けしません。</p>
        </section>
        <section>
          <h2 style={{ fontSize: 24 }}>ルールの根拠</h2>
          <p><a href="https://tabelog.com/help/review_guide/" rel="noopener noreferrer" target="_blank">食べログ・口コミガイドライン（特に第12項） ↗</a></p>
          <p><a href="https://support.google.com/contributionpolicy/answer/7400114" rel="noopener noreferrer" target="_blank">Googleマップ・禁止および制限されるコンテンツ ↗</a></p>
          <p><a href="https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing" rel="noopener noreferrer" target="_blank">消費者庁・ステルスマーケティングに関するQ&A ↗</a></p>
          <p style={{ fontSize: 12, color: "#777" }}>ポリシー制定：2026年10月16日。掲載内容は当サービスの受注方針であり、各法律・利用規約がすべての口コミ行為を一律に違法としているとの意味ではありません。各媒体の最新ルールを優先します。</p>
        </section>
      </article>
      <div style={{ textAlign: "center", padding: "40px 0 20px" }}>
        <Link className="diary-button diary-button-primary" href="/diary/request">ポリシーに沿ったPRを相談する ↗</Link>
      </div>
    </main>
  );
}
