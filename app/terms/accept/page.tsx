import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatTermsVersion, TERMS_VERSION } from "@/lib/legal";
import { safeNextPath, safeRole, withNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/server";
import { acceptTerms, signOut } from "@/server/actions/auth";
import { resolveSignedInDestination } from "@/server/auth/resolve-destination";

export const metadata: Metadata = { title: "利用規約への同意 | GOURMET DIARY PR OS" };

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string; role?: string }>;
}) {
  const { message, next: rawNext, role: rawRole } = await searchParams;
  const next = safeNextPath(rawNext);
  const role = safeRole(rawRole);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect(withNext("/login", next, role));

  const destination = await resolveSignedInDestination();
  if (destination === "/onboarding") redirect(withNext(destination, next, role));
  if (destination !== "/terms/accept") redirect(next ?? destination);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>利用規約への同意</h1>
        <p className="auth-lead">
          ご利用を続けるには、{formatTermsVersion()}施行の利用規約とプライバシーポリシーへの同意が必要です。
        </p>

        {message ? <div className="form-message">{message}</div> : null}

        <form action={acceptTerms} className="form-stack">
          {next ? <input name="next" type="hidden" value={next} /> : null}
          {role ? <input name="role" type="hidden" value={role} /> : null}
          <label className="consent-check">
            <input name="agreeTerms" required type="checkbox" value={TERMS_VERSION} />
            <span>
              <Link href="/terms" target="_blank">利用規約</Link>と
              <Link href="/privacy" target="_blank">プライバシーポリシー</Link>
              に同意します
            </span>
          </label>
          <button className="primary-button form-submit" type="submit">同意して進む</button>
        </form>

        <form action={signOut} className="auth-switch">
          <button className="secondary-button" type="submit">同意せずにログアウト</button>
        </form>
      </section>
    </main>
  );
}
