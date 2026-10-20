// Resend over plain fetch. Replace this module to change email providers.
const SEND_TIMEOUT_MS = 5_000;

export type Mail = { to: string; subject: string; text: string; html: string };

export async function sendEmail(
  mail: Mail,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.WAITLIST_FROM_EMAIL?.trim() || "Praci <hello@praci.ai>",
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function siteUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.PUBLIC_SITE_URL?.trim() || "https://praci.ai").replace(/\/+$/, "");
}

export function linkMail(to: string, token: string, confirmed: boolean, env = process.env): Mail {
  const link = `${siteUrl(env)}/you?token=${encodeURIComponent(token)}`;
  const sentence = confirmed
    ? "Here is your Praci waitlist link:"
    : "Confirm your spot on the Praci waitlist:";
  return {
    to,
    subject: confirmed ? "Your Praci waitlist link" : "Confirm your Praci waitlist spot",
    text: `${sentence}\n\n${link}\n`,
    html: `<p>${sentence}</p><p><a href="${link}">${link}</a></p>`,
  };
}
