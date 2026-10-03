"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const claimErrors: Array<[string, string]> = [
  ["creator_profile_required", "Creatorとして登録すると受けられます。"],
  ["invite_already_claimed", "この依頼はすでに別のアカウントで受け付けられています。"],
  ["invite_closed", "この依頼の受付は終了しています。"],
  ["invite_not_found", "依頼が見つかりませんでした。"],
];

export async function claimInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]{20}$/.test(token)) redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_offer_invite", { p_token: token });

  if (error || !data) {
    const reason = error?.message ?? "";
    const known = claimErrors.find(([key]) => reason.includes(key));
    redirect(`/i/${token}?message=` + encodeURIComponent(known?.[1] ?? "受け付けできませんでした。"));
  }

  redirect(`/creator/campaigns/${data}`);
}
