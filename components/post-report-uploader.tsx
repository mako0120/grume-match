"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerPostReport } from "@/server/actions/pr-feedback";

const allowed = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// Screenshot of one PR post's insights. Read by the Operator / Claude; the
// Restaurant only sees the numbers.
export function PostReportUploader({
  bookingId,
  deliverableId,
  userId,
}: {
  bookingId: string;
  deliverableId: string;
  userId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setMessage(null);

    if (!allowed.includes(file.type)) {
      setMessage({ text: "スクリーンショットの画像を選んでください。", ok: false });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ text: "10MB以下の画像にしてください。", ok: false });
      return;
    }

    setBusy(true);
    try {
      const path = `${userId}/post-${deliverableId}-${crypto.randomUUID()}.${extensions[file.type]}`;
      const { error } = await createClient()
        .storage.from("creator-evidence")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) {
        setMessage({ text: "アップロードできませんでした。", ok: false });
        return;
      }

      const result = await registerPostReport({ bookingId, deliverableId, storagePath: path });
      setMessage(
        result.ok
          ? { text: "送信しました。数字を読み取って登録したら通知でお知らせします。", ok: true }
          : { text: result.message, ok: false },
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <div className="ugc-uploader">
      <label className={busy ? "ugc-drop is-busy" : "ugc-drop"}>
        <input
          accept={allowed.join(",")}
          disabled={busy}
          onChange={(event) => upload(event.currentTarget.files?.[0])}
          ref={inputRef}
          type="file"
        />
        <strong>{busy ? "送信中..." : "この投稿のインサイトを送る"}</strong>
        <span>投稿の「インサイトを見る」画面のスクショ1枚でOK。画像は店舗には表示されません。</span>
      </label>
      {message ? (
        <div
          className={message.ok ? "form-message inline-success" : "form-message error-message"}
          aria-live="polite"
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}
