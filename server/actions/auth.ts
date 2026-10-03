"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RETURN_TO_COOKIE, safeReturnTo } from "@/lib/return-to";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInDestination } from "@/server/auth/resolve-destination";

function withMessage(path: string, message: string, next?: string | null) {
  const params = new URLSearchParams({ message });
  if (next) params.set("next", next);
  return `${path}?${params.toString()}`;
}

// Remember an order page across email confirmation and onboarding.
async function rememberReturnTo(next: string | null) {
  if (!next) return;
  const cookieStore = await cookies();
  cookieStore.set(RETURN_TO_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeReturnTo(formData.get("next"));

  if (!email || !password) {
    redirect(withMessage("/login", "メールアドレスとパスワードを入力してください。", next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(withMessage("/login", "ログインできませんでした。入力内容をご確認ください。", next));
  }

  const destination = await resolveSignedInDestination();

  if (next && destination === "/restaurant") redirect(next);
  if (next && destination === "/onboarding") await rememberReturnTo(next);

  redirect(destination);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeReturnTo(formData.get("next"));

  if (!email || password.length < 8) {
    redirect(withMessage("/signup", "8文字以上のパスワードとメールアドレスを入力してください。", next));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(withMessage("/signup", "アカウントを作成できませんでした。", next));
  }

  await rememberReturnTo(next);

  if (!data.session) {
    redirect(withMessage("/login", "確認メールを送信しました。認証後にログインしてください。", next));
  }

  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
