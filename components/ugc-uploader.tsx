"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  MAX_UGC_FILES_PER_DELIVERABLE,
  UGC_BUCKET,
  type UgcKind,
  ugcObjectPath,
  ugcRules,
  validateUgcFile,
} from "@/lib/content-rights";
import { createClient } from "@/lib/supabase/client";
import { registerUgcAsset } from "@/server/actions/studio";

// Uploads UGC files straight to the private Storage bucket (large videos
// would exceed server action body limits), then registers each file.
export function UgcUploader({
  bookingId,
  deliverableId,
  existingCount,
  kind,
  userId,
}: {
  bookingId: string;
  deliverableId: string;
  existingCount: number;
  kind: UgcKind;
  userId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const remaining = MAX_UGC_FILES_PER_DELIVERABLE - existingCount;

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    setError("");

    if (files.length > remaining) {
      setError(`あと${Math.max(0, remaining)}ファイルまでアップロードできます。`);
      return;
    }

    for (const file of files) {
      const problem = validateUgcFile(kind, file);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        return;
      }
    }

    setBusy(true);
    const supabase = createClient();

    try {
      for (const [index, file] of files.entries()) {
        setProgress(`${index + 1} / ${files.length} をアップロード中...`);

        const storagePath = ugcObjectPath(
          userId,
          deliverableId,
          file.type,
          crypto.randomUUID(),
        );

        const { error: uploadError } = await supabase.storage
          .from(UGC_BUCKET)
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          setError(`${file.name}: アップロードできませんでした。`);
          return;
        }

        const result = await registerUgcAsset({
          bookingId,
          deliverableId,
          storagePath,
        });

        if (!result.ok) {
          setError(`${file.name}: ${result.message}`);
          return;
        }
      }
    } finally {
      setBusy(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  const rule = ugcRules[kind];

  return (
    <div className="ugc-uploader">
      <label className={busy ? "ugc-drop is-busy" : "ugc-drop"}>
        <input
          accept={rule.accept}
          disabled={busy || remaining <= 0}
          multiple
          onChange={(event) => handleFiles(event.currentTarget.files)}
          ref={inputRef}
          type="file"
        />
        <strong>
          {busy
            ? progress
            : kind === "photo"
              ? "写真を選択してアップロード"
              : "縦動画を選択してアップロード"}
        </strong>
        <span>
          {kind === "photo" ? "JPEG・PNG・WebP・HEIC" : "MP4・MOV"}／1ファイル
          {Math.floor(rule.maxBytes / 1024 / 1024)}MBまで／最大
          {MAX_UGC_FILES_PER_DELIVERABLE}ファイル
        </span>
      </label>

      {error ? (
        <div className="form-message error-message" aria-live="polite">
          {error}
        </div>
      ) : null}
    </div>
  );
}
