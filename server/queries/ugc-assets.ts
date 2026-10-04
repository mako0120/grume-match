import type { SupabaseClient } from "@supabase/supabase-js";
import { UGC_BUCKET } from "@/lib/content-rights";

export type RawContentAsset = {
  id: string;
  kind: "photo" | "video";
  storage_path: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
};

export type PresentedContentAsset = {
  id: string;
  kind: "photo" | "video";
  mimeType: string;
  byteSize: number;
  createdAt: string;
  viewUrl: string | null;
  downloadUrl: string | null;
};

export type RawUsageLicense = {
  usage_scope: "organic" | "organic_and_ads";
  duration_days: number;
  fee: number;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
};

export function presentLicense(raw: RawUsageLicense | RawUsageLicense[] | null) {
  const license = Array.isArray(raw) ? raw[0] ?? null : raw;
  if (!license) return null;

  return {
    usageScope: license.usage_scope,
    durationDays: license.duration_days,
    fee: license.fee,
    status: license.status,
    startsAt: license.starts_at,
    expiresAt: license.expires_at,
  };
}

const SIGNED_URL_SECONDS = 10 * 60;

/**
 * Short-lived signed URLs for UGC files. Storage RLS decides access, so files
 * the viewer may not open (e.g. after license expiry) come back without URLs.
 */
export async function signContentAssets(
  supabase: SupabaseClient,
  assets: RawContentAsset[],
): Promise<PresentedContentAsset[]> {
  if (!assets.length) return [];

  const paths = assets.map((asset) => asset.storage_path);
  const bucket = supabase.storage.from(UGC_BUCKET);

  const [viewResult, downloadResult] = await Promise.all([
    bucket.createSignedUrls(paths, SIGNED_URL_SECONDS),
    bucket.createSignedUrls(paths, SIGNED_URL_SECONDS, { download: true }),
  ]);

  const urlFor = (
    result: typeof viewResult,
    path: string,
  ): string | null => {
    const entry = result.data?.find((item) => item.path === path);
    return entry && !entry.error ? entry.signedUrl : null;
  };

  return assets
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mime_type,
      byteSize: asset.byte_size,
      createdAt: asset.created_at,
      viewUrl: urlFor(viewResult, asset.storage_path),
      downloadUrl: urlFor(downloadResult, asset.storage_path),
    }));
}
