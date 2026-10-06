import type { Metadata } from "next";
import { readOperatorInfo } from "@/lib/legal";
import {
  PLATFORM_FEE_MINIMUM,
  PLATFORM_FEE_RATE,
  PLATFORM_FEE_TAX_RATE,
} from "@/lib/pricing";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | GOURMET DIARY PR OS",
};

export const dynamic = "force-dynamic";

function Value({ value }: { value: string | null }) {
  return value ? <>{value}</> : <span className="legal-missing">未設定</span>;
}

export default function LegalNoticePage() {
  const operator = readOperatorInfo();
  const feePercent = PLATFORM_FEE_RATE * 100;
  const feeMinimum = PLATFORM_FEE_MINIMUM.toLocaleString("ja-JP");
  const taxPercent = PLATFORM_FEE_TAX_RATE * 100;

  return (
    <main className="legal-shell">
      <span className="eyebrow">GOURMET DIARY</span>
      <h1>特定商取引法に基づく表記</h1>

      <table className="legal-table">
        <tbody>
          <tr>
            <th>販売事業者</th>
            <td><Value value={operator.name} /></td>
          </tr>
          <tr>
            <th>運営統括責任者</th>
            <td><Value value={operator.representative} /></td>
          </tr>
          <tr>
            <th>所在地</th>
            <td><Value value={operator.address} /></td>
          </tr>
          <tr>
            <th>電話番号</th>
            <td><Value value={operator.phone} /></td>
          </tr>
          <tr>
            <th>メールアドレス</th>
            <td>
              {operator.email ? (
                <a href={`mailto:${operator.email}`}>{operator.email}</a>
              ) : (
                <Value value={null} />
              )}
            </td>
          </tr>
          <tr>
            <th>サービスの内容</th>
            <td>飲食店とグルメクリエイターの有償PR案件のマッチングと進行管理（GOURMET DIARY PR OS）</td>
          </tr>
          <tr>
            <th>販売価格</th>
            <td>
              初期費用・月額費用：0円
              <br />
              手数料（店舗のみ）：PRが完了した時に、報酬額の{feePercent}％（最低{feeMinimum}円。食事招待のみの場合は{feeMinimum}円）
              <br />
              表示価格は税抜です。別途消費税（{taxPercent}％）がかかります。Creatorの利用は無料です。
            </td>
          </tr>
          <tr>
            <th>商品代金以外の必要料金</th>
            <td>インターネット接続料金・通信料金、銀行振込の場合の振込手数料はお客様のご負担となります。</td>
          </tr>
          <tr>
            <th>支払方法</th>
            <td>請求書（Stripe）によるクレジットカード払いまたは銀行振込</td>
          </tr>
          <tr>
            <th>支払時期</th>
            <td>前月に完了したPRの手数料を毎月まとめて請求し、請求書発行日から14日以内にお支払いいただきます。</td>
          </tr>
          <tr>
            <th>役務の提供時期</th>
            <td>アカウント登録後、直ちにご利用いただけます。手数料はPRの完了（投稿の承認）をもって発生します。</td>
          </tr>
          <tr>
            <th>返品・キャンセル</th>
            <td>
              役務の性質上、PR完了後の手数料の返金はいたしかねます。当社の責に帰すべき事由がある場合は、個別にご相談ください。PR完了前のキャンセルには手数料はかかりません。
            </td>
          </tr>
          <tr>
            <th>動作環境</th>
            <td>最新版のSafari、Google Chrome、Microsoft Edge、Firefox</td>
          </tr>
        </tbody>
      </table>

      <p className="legal-meta">
        Creatorへの報酬は店舗からCreatorへ直接お支払いいただくもので、当社は預からず、支払いを代行しません。
      </p>
    </main>
  );
}
