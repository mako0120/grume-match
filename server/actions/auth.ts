"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedInDestination } from "@/server/auth/resolve-destination";

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

  redirect(await resolveSignedInDestination());
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const policyConsent = formData.get("policyConsent") === "on";
  const privateAlpha = process.env.PUBLIC_LAUNCH_ENABLED !== "true";
  const submittedAccessCode = String(
    formData.get("privateAlphaAccessCode") ?? "",
  ).trim();
  const configuredAccessCode =
    process.env.PRIVATE_ALPHA_ACCESS_CODE?.trim() ?? "";

  if (!policyConsent) {
    redirect(
      withMessage(
        "/signup",
        "利用規約・プライバシーポリシー・PRガイドラインへの同意が必要です。",
      ),
    );
  }

  if (privateAlpha) {
    if (
      !configuredAccessCode ||
      !submittedAccessCode ||
      submittedAccessCode !== configuredAccessCode
    ) {
      redirect(
        withMessage(
          "/signup",
          "Private Alphaの招待コードを確認してください。",
        ),
      );
    }
  }

  if (!email || password.length < 8) {
    redirect(
      withMessage(
        "/signup",
        "8文字以上のパスワードとメールアドレスを入力してください。",
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(withMessage("/signup", "アカウントを作成できませんでした。"));
  }

  if (!data.session) {
    redirect(
      withMessage(
        "/login",
        "確認メールを送信しました。認証後にログインしてください。",
      ),
    );
  }

  redirect("/legal/accept");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}


export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(withMessage("/forgot-password", "メールアドレスを入力してください。"));
  }

  const requestHeaders = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    requestHeaders.get("origin");

  if (!origin) {
    redirect(withMessage("/forgot-password", "パスワード再設定を開始できませんでした。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin + "/auth/confirm?next=/update-password",
  });

  if (error) {
    redirect(withMessage("/forgot-password", "再設定メールを送信できませんでした。"));
  }

  redirect(
    withMessage(
      "/login",
      "パスワード再設定メールを送信しました。メール内のリンクから続けてください。",
    ),
  );
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  if (password.length < 8) {
    redirect(withMessage("/update-password", "パスワードは8文字以上で入力してください。"));
  }

  if (password !== confirmation) {
    redirect(withMessage("/update-password", "確認用パスワードが一致しません。"));
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(withMessage("/login", "再設定リンクの有効期限が切れています。もう一度お試しください。"));
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(withMessage("/update-password", "パスワードを更新できませんでした。"));
  }

  redirect(withMessage("/login", "パスワードを更新しました。新しいパスワードでログインしてください。"));
}
