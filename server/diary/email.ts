import "server-only";

export function diaryEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendDiaryEmail(
  to: string,
  subject: string,
  body: string,
  key: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Diary email provider not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify({
      from, to: [to], subject: "[グルメ日誌｜大阪] " + subject, text: body,
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Diary email provider failed: " + response.status);
}

export function diaryOwnerEmail(): string | null {
  const value = process.env.DIARY_OPERATOR_NOTIFY_EMAIL?.trim() || "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}
