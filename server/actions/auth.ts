"use server";

import { redirect } from "next/navigation";
import { safeNextPath, safeRole, withNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInDestination } from "@/server/auth/resolve-destination";

function withMessage(path: string, message: string) {
  return `${path}?message=${encodeURIComponent(message)}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const role = safeRole(formData.get("role"));

  if (!email || !password) {
    redirect(withNext(withMessage("/login", "メールアドレスとパスワードを入力してください。"), next, role));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(withNext(withMessage("/login", "ログインできませんでした。入力内容をご確認ください。"), next, role));
  }

  const destination = await resolveSignedInDestination();
  if (destination === "/onboarding") redirect(withNext("/onboarding", next, role));
  redirect(next ?? destination);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const role = safeRole(formData.get("role"));

  if (!email || password.length < 8) {
    redirect(withNext(withMessage("/signup", "8文字以上のパスワードとメールアドレスを入力してください。"), next, role));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(withNext(withMessage("/signup", "アカウントを作成できませんでした。"), next, role));
  }

  if (!data.session) {
    redirect(withNext(withMessage("/login", "確認メールを送信しました。認証後にログインしてください。"), next, role));
  }

  redirect(withNext("/onboarding", next, role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
