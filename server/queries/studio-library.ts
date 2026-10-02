import { licenseState, type LicenseState } from "@/lib/content-rights";
import { createClient } from "@/lib/supabase/server";
import {
  presentLicense,
  signContentAssets,
  type RawContentAsset,
  type RawUsageLicense,
} from "@/server/queries/ugc-assets";

type Relation<T> = T | T[] | null;

function single<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

type RawLibraryBooking = {
  id: string;
  creator_profiles: Relation<{ display_name: string }>;
  campaigns: Relation<{ title: string }>;
  content_usage_licenses: Relation<RawUsageLicense>;
  content_assets: (RawContentAsset & {
    deliverables: Relation<{ verification_status: string }>;
  })[] | null;
};

const stateOrder: Record<LicenseState, number> = {
  expiring: 0,
  active: 1,
  not_started: 2,
  expired: 3,
};

/** Every booking of the Restaurant that delivered UGC files. */
export async function listRestaurantLibrary() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id")
    .eq("user_id", authData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      creator_profiles(display_name),
      campaigns!inner(title,restaurant_id),
      content_usage_licenses(usage_scope,duration_days,fee,status,starts_at,expires_at),
      content_assets!inner(
        id,kind,storage_path,mime_type,byte_size,created_at,
        deliverables(verification_status)
      )
    `)
    .eq("campaigns.restaurant_id", membership.restaurant_id)
    .order("confirmed_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const now = new Date();
  const rows = (data ?? []) as unknown as RawLibraryBooking[];

  const entries = await Promise.all(
    rows.map(async (row) => {
      const license = presentLicense(single(row.content_usage_licenses));
      const state = license
        ? licenseState(license, now)
        : { state: "not_started" as LicenseState, daysLeft: null };
      const assets = row.content_assets ?? [];
      const approved = assets.filter(
        (asset) => single(asset.deliverables)?.verification_status === "approved",
      );

      return {
        bookingId: row.id,
        creatorName: single(row.creator_profiles)?.display_name ?? "Creator",
        campaignTitle: single(row.campaigns)?.title ?? "PR案件",
        license,
        state: state.state,
        daysLeft: state.daysLeft,
        reviewing: approved.length < assets.length,
        // Only accepted files belong in the library; files under review are
        // handled from the booking page.
        assets: await signContentAssets(supabase, approved),
      };
    }),
  );

  return entries
    .filter((entry) => entry.assets.length > 0 || entry.reviewing)
    .sort((a, b) => stateOrder[a.state] - stateOrder[b.state]);
}
