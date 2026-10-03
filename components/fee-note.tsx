import { formatFeeRule, platformFee } from "@/lib/pricing";

// Shown under the reward field: what the Restaurant pays on top, and when.
export function FeeNote() {
  return (
    <p className="field-help fee-note">
      初期費用・月額0円。手数料は{formatFeeRule()}。Creatorには報酬を全額お支払いします。最初の1件は手数料無料。
      例：食事招待のみ → 手数料¥{platformFee(0).toLocaleString("ja-JP")}／報酬¥8,000 → ¥{platformFee(8000).toLocaleString("ja-JP")}／報酬¥15,000 → ¥{platformFee(15000).toLocaleString("ja-JP")}
    </p>
  );
}
