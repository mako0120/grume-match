"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setStandby(enabled: boolean) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("set_creator_standby", {
    p_enabled: enabled,
  });

  if (error) {
    return { ok: false as const, message: "状態を更新できませんでした。" };
  }

  revalidatePath("/creator/standby");
  revalidatePath("/creator/campaigns");

  return {
    ok: true as const,
    availableUntil: data as string | null,
  };
}
