import type { CredentialField } from "@rakazo/core";
import { authErrorMessage, plainRunError, userErrorMessage } from "@rakazo/core";
import { t } from "./i18n";

/** Text for a failure: human messages pass through; network and implementation detail become copy. */
export function errorText(
  error: unknown,
  fallback = t("Something went wrong. Try again."),
): string {
  return userErrorMessage(error, { fallback, offline: t("Could not reach the server") });
}

/** A run's stored error as the user reads it: a known cause is named and says where to fix it. */
export function runErrorText(error: string): string {
  return plainRunError(error, {
    keyRejected: t(
      "The model provider did not accept your API key. Check it in Settings > Models.",
    ),
    generic: t("Something went wrong. Try again."),
    spendLimit: (resetsOn) =>
      resetsOn
        ? t(
            "The AI key hit its spending limit. It resets {resetsOn}. Raise the limit with your provider or use another key in Settings > Models.",
            { resetsOn },
          )
        : t(
            "The AI key hit its spending limit. Raise the limit with your provider or use another key in Settings > Models.",
          ),
    outOfCredits: t(
      "The AI account is out of credits. Add credits with your provider or use another key in Settings > Models.",
    ),
    rateLimited: t("The model provider is rate limiting requests. Try again in a few minutes."),
  });
}

export function credentialIssueText(field: CredentialField): string {
  return field === "email" ? t("Enter a valid email") : t("Enter a password");
}

/** Text for a failed auth response body. */
export function authErrorText(body: unknown, fallback: string): string {
  const code = body && typeof body === "object" && "code" in body ? body.code : undefined;
  if (code === "SSO_UNAVAILABLE") return t("SSO is temporarily unavailable. Try again.");
  if (code === "account_not_linked") return t("Sign in to your existing account to link SSO");
  if (code === "REGISTRATION_CLOSED") return t("Registration is closed");
  if (code === "EMAIL_NOT_ALLOWED") return t("Email is not allowed to register");
  if (code === "EMAIL_VERIFICATION_REQUIRED" || code === "unable_to_link_account")
    return t("Email verification required");
  if (code === "REAUTHENTICATION_REQUIRED") return t("Sign in again");
  if (code === "PASSWORD_AUTH_DISABLED" || code === "EMAIL_DELETION_UNAVAILABLE")
    return t("Could not continue");
  return authErrorMessage(body, {
    fallback,
    email: credentialIssueText("email"),
    password: credentialIssueText("password"),
  });
}
