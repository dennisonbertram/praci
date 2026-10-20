// Optional confirmation email through Resend. Skipped silently without RESEND_API_KEY.
export async function sendConfirmation(
  to: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.WAITLIST_FROM_EMAIL?.trim() || "Praci <hello@praci.ai>",
        to: [to],
        subject: "You are on the Praci hosted waitlist",
        text: "Thanks for signing up. We will email you when the hosted version is ready.\n",
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // The signup is already saved; a failed email must not fail the request.
  }
}
