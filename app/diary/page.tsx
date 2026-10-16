import Link from "next/link";

const metrics = [
  { value: "17.6万", unit: "回", label: "コンテンツ再生数" },
  { value: "76,876", unit: "人", label: "閲覧者" },
  { value: "+1,335", unit: "人", label: "純フォロワー増加" },
];

const offerings = [
  { number: "01", title: "Instagramフィード投稿", desc: "お料理やお店の雰囲気を、写真と言葉で丁寧に紹介。気になった方が後から見返せる投稿を制作します。", tag: "写真で魅力を伝える" },
  { number: "02", title: "リール・ショート動画", desc: "調理風景や盛り付け、店内の空気感をテンポよく編集。来店前のワクワクを動画で届けます。", tag: "動画で体験を届ける" },
  { number: "03", title: "ストーリーズ・撮影素材", desc: "イベントのお知らせや新メニュー紹介、店舗で活用する写真・動画素材もご相談いただけます。", tag: "用途に合わせて相談" },
];

export default function DiaryHomePage() {
  return (
    <>
      <header className="diary-nav">
        <Link className="diary-logo" href="/diary" aria-label="グルメ日誌 ホーム">
          <span className="diary-logo-mark">食</span>
          <span>グルメ日誌 <small>OSAKA</small></span>
        </Link>
        <nav aria-label="ページ内メニュー">
          <a href="#philosophy">想い</a>
          <a href="#services">サービス</a>
          <a href="#results">実績</a>
          <Link className="diary-nav-contact" href="/diary/request">PRの相談 <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <main>
        <section className="diary-hero">
          <div className="diary-hero-copy">
            <div className="diary-overline"><span className="diary-dot" /> OSAKA GOURMET CREATOR</div>
            <h1>まだ知らない<br /><em>「おいしい」</em>に、<br />出会うきっかけを。</h1>
            <p>おいしいご飯が好きだから。まだ知られていないお店の魅力を、もっと多くの人へ。大阪のグルメ日誌が、あなたのお店と次のお客様の出会いをつくります。</p>
            <div className="diary-actions">
              <Link className="diary-button diary-button-primary" href="/diary/request">お店のPRを相談する <span>↗</span></Link>
              <a className="diary-button diary-button-quiet" href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">Instagramを見る ↗</a>
            </div>
            <span className="diary-hero-caption">PRのご相談・お見積もりは無料です</span>
          </div>
          <div className="diary-hero-art" aria-hidden="true">
            <span className="diary-art-circle one" />
            <span className="diary-art-circle two" />
            <div className="diary-art-label">DISCOVER<br />YOUR NEXT<br /><strong>おいしい。</strong></div>
            <div className="diary-art-stamp">GOURMET<br />DIARY<br />OSAKA</div>
            <div className="diary-art-bottom">大阪には、まだ知らないごちそうがある。</div>
          </div>
          <div className="diary-hero-index">01 / 04 — WELCOME</div>
        </section>

        <section className="diary-stats-section" id="results">
          <div className="diary-section-top"><span>OUR REACH</span><span>2026.09.16 — 10.15 / 30 DAYS</span></div>
          <div className="diary-stats-heading">
            <h2>小さなアカウントから、<br /><em>大きな出会いへ。</em></h2>
            <p>フォロワー数だけでは見えない、実際の発信実績。日々の投稿を通して、多くの方に新しいグルメの発見を届けています。</p>
          </div>
          <div className="diary-stats">
            {metrics.map((metric) => (
              <div className="diary-stat" key={metric.label}>
                <div><strong>{metric.value}</strong><span>{metric.unit}</span></div>
                <p>{metric.label}</p>
              </div>
            ))}
          </div>
          <div className="diary-stats-foot">
            <span>Instagramインサイトに基づく直近30日間の実績（2026年10月16日時点）</span>
            <span>※再生数は延べ回数です。PR成果や来店を保証する数値ではありません。</span>
          </div>
        </section>

        <section className="diary-philosophy" id="philosophy">
          <div className="diary-section-top"><span>OUR STORY</span><span>食べることが、好きだから。</span></div>
          <div className="diary-story-grid">
            <div className="diary-story-mark" aria-hidden="true"><span>おいしい、の<br />向こう側へ。</span><i>食</i></div>
            <div>
              <span className="diary-kicker">グルメ日誌が大切にしていること</span>
              <h2>このアカウントがなければ、<br />出会えなかった<br /><em>一皿がある。</em></h2>
              <p>大阪には、まだ知らない素敵なお店がたくさんあります。自分自身が食べることが好きだからこそ、そんなお店を見つける喜びを、誰かと分かち合いたい。</p>
              <p>「こんなお店があったんだ」「次の休みに行ってみよう」——そんな小さな発見が、誰かの大切な食事の思い出につながると信じています。</p>
              <p className="diary-story-closing">お店にも、食べる人にも、<br />うれしい出会いを。</p>
            </div>
          </div>
        </section>

        <section className="diary-offerings" id="services">
          <div className="diary-section-top"><span>WHAT WE DO</span><span>YOUR RESTAURANT, OUR STORY.</span></div>
          <div className="diary-offerings-title"><h2>お店の「伝えたい」を、<br /><em>届くかたちに。</em></h2><p>撮影から編集・発信まで、グルメ日誌本人が対応。お店の個性に合わせてご提案します。</p></div>
          <div className="diary-offerings-list">
            {offerings.map((item) => (
              <article className="diary-offering" key={item.number}>
                <span className="diary-offering-number">{item.number}</span>
                <div><span className="diary-offering-tag">{item.tag}</span><h3>{item.title}</h3><p>{item.desc}</p></div>
                <span className="diary-offering-arrow">↗</span>
              </article>
            ))}
          </div>
          <p className="diary-disclosure-note">※PR投稿には広告・提供関係が分かる適切な表記を行います。食べログ・Googleマップ等への対価付き口コミ、高評価の指定、ステルスマーケティングはお受けしていません。<Link href="/diary/policy">案件受注ポリシー ↗</Link></p>
        </section>

        <section className="diary-reassurance">
          <div><span className="diary-kicker">WHY GOURMET DIARY?</span><h2>誰に頼むか迷ったら、<br /><em>まず実績を見てください。</em></h2></div>
          <div className="diary-reassurance-items">
            <p><b>01</b> インサイトを公開しているから、依頼前に発信規模を確認できる。</p>
            <p><b>02</b> 窓口も撮影・制作も本人。誰が投稿するか明確。</p>
            <p><b>03</b> 依頼内容・納品物・費用を事前に相談し、認識のずれを減らす。</p>
          </div>
        </section>

        <section className="diary-steps">
          <div className="diary-section-top"><span>HOW IT WORKS</span><span>お申し込みは約3分</span></div>
          <h2>PRのご依頼は、<em>シンプルに。</em></h2>
          <div className="diary-step-grid">
            <div><b>01</b><h3>ご相談</h3><p>店舗情報とご希望をフォームから送信。</p></div>
            <div><b>02</b><h3>ご提案</h3><p>内容・費用・スケジュールをご相談。</p></div>
            <div><b>03</b><h3>訪問・撮影</h3><p>お店を訪れて魅力を取材・撮影。</p></div>
            <div><b>04</b><h3>制作・発信</h3><p>合意した内容に沿って投稿。</p></div>
          </div>
        </section>

        <section className="diary-final-cta">
          <span>YOUR NEXT STORY STARTS HERE.</span>
          <h2>このアカウントで出会う、<br /><em>そんなご飯はいかがですか。</em></h2>
          <p>あなたのお店だけの「おいしい」を、まだ知らない誰かへ。</p>
          <Link className="diary-button diary-button-light" href="/diary/request">グルメ日誌にPRを相談する <span>↗</span></Link>
        </section>
      </main>

      <footer className="diary-footer">
        <div><strong>グルメ日誌 <small>OSAKA</small></strong><p>まだ知らない「おいしい」に、出会うきっかけを。</p></div>
        <div className="diary-footer-links">
          <a href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">INSTAGRAM ↗</a>
          <Link href="/legal/privacy">プライバシー</Link>
          <Link href="/legal/operator">運営者情報</Link>
          <Link href="/diary/request">PRのご相談</Link>
        </div>
        <span className="diary-copyright">© 2026 GOURMET DIARY OSAKA</span>
      </footer>
    </>
  );
}
