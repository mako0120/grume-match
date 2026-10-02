import { formatBytes } from "@/lib/content-rights";
import type { PresentedContentAsset } from "@/server/queries/ugc-assets";

export function UgcAssetGrid({
  assets,
  bookingId,
  removeAction,
  showDownload = false,
}: {
  assets: PresentedContentAsset[];
  bookingId?: string;
  removeAction?: (formData: FormData) => Promise<void>;
  showDownload?: boolean;
}) {
  if (!assets.length) return null;

  return (
    <ul className="ugc-grid">
      {assets.map((asset, index) => (
        <li className="ugc-tile" key={asset.id}>
          {asset.viewUrl ? (
            asset.kind === "photo" ? (
              // Signed Storage URLs are short-lived; next/image would cache them.
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`UGC写真 ${index + 1}`} loading="lazy" src={asset.viewUrl} />
            ) : (
              <video controls playsInline preload="metadata" src={asset.viewUrl} />
            )
          ) : (
            <div className="ugc-locked">閲覧期間外</div>
          )}

          <div className="ugc-tile-meta">
            <span>
              {asset.kind === "photo" ? "写真" : "動画"}・{formatBytes(asset.byteSize)}
            </span>
            {showDownload && asset.downloadUrl ? (
              <a href={asset.downloadUrl}>保存</a>
            ) : null}
            {removeAction && bookingId ? (
              <form action={removeAction}>
                <input name="assetId" type="hidden" value={asset.id} />
                <input name="bookingId" type="hidden" value={bookingId} />
                <button className="text-button" type="submit">
                  削除
                </button>
              </form>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
