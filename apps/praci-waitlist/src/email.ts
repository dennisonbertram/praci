// Optional confirmation email through Resend. Skipped without RESEND_API_KEY.
const GITHUB_INSTALL = "https://github.com/dennisonbertram/praci#quick-start-for-developers";
const FONT = "'Vault Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.PUBLIC_SITE_URL?.trim() || "https://praci.ai").replace(/\/+$/, "");
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function confirmationMail(
  token: string,
  referralCode: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const statusUrl = `${siteUrl(env)}/you?token=${encodeURIComponent(token)}`;
  const referralUrl = `${siteUrl(env)}/?ref=${encodeURIComponent(referralCode)}`;
  const subject = "You're on the Praci waitlist";
  const text = [
    "You're on the list for Praci Cloud.",
    `See your place in line: ${statusUrl}`,
    "Move up the line",
    `Each friend who joins with your link moves you up 10 places.\n${referralUrl}`,
    "Start now on your own machine",
    `Praci is open source. Clone it from GitHub and run it locally.\nInstall from GitHub: ${GITHUB_INSTALL}`,
    "You got this because you joined the waitlist at praci.ai.",
  ].join("\n\n");

  const link = (href: string, label: string) =>
    `<a href="${esc(href)}" style="color:#1a1a1a;text-decoration:underline;">${esc(label)}</a>`;
  const heading = (label: string) =>
    `<h2 style="margin:32px 0 8px;font-size:16px;font-weight:600;color:#1a1a1a;">${esc(label)}</h2>`;
  const para = (inner: string) =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#5f5f5b;">${inner}</p>`;
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#fafaf8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafaf8;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;font-family:${FONT};"><tr><td style="font-family:${FONT};">
<div style="font-size:24px;font-weight:600;color:#1a1a1a;margin:0 0 32px;">praci</div>
<p style="margin:0 0 24px;font-size:20px;line-height:1.3;color:#1a1a1a;">You're on the list for Praci Cloud.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#1a1a1a;border-radius:8px;"><a href="${esc(statusUrl)}" style="display:inline-block;padding:12px 20px;font-size:15px;color:#fafaf8;text-decoration:none;">See your place in line</a></td></tr></table>
${heading("Move up the line")}
${para("Each friend who joins with your link moves you up 10 places.")}
${para(link(referralUrl, referralUrl))}
${heading("Start now on your own machine")}
${para("Praci is open source. Clone it from GitHub and run it locally.")}
${para(link(GITHUB_INSTALL, "Install from GitHub"))}
<p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #d6d5d0;font-size:13px;line-height:1.5;color:#5f5f5b;">You got this because you joined the waitlist at praci.ai.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}

/** Sends the confirmation. True when sent, or when no API key is set (local dev). */
export async function sendConfirmation(
  to: string,
  token: string,
  referralCode: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return true;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.WAITLIST_FROM_EMAIL?.trim() || "Praci <hello@praci.ai>",
        to: [to],
        ...confirmationMail(token, referralCode, env),
      }),
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
