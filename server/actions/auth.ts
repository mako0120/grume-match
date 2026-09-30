"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function withMessage(path: string, message: string) {
  return `${path}?message=${encodeURIComponent(message)}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(withMessage("/login", "メールアドレスとパスワードを入力してください。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(withMessage("/login", "ログインできませんでした。入力内容をご確認ください。"));
  }

  redirect("/onboarding");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 8) {
    redirect(withMessage("/signup", "8文字以上のパスワードとメールアドレスを入力してください。"));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(withMessage("/signup", "アカウントを作成できませんでした。"));
  }

  if (!data.session) {
    redirect(withMessage("/login", "確認メールを送信しました。認証後にログインしてください。"));
  }

  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
