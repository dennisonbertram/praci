import type { MailApproval } from "@rakazo/contracts";
import { t } from "./i18n";

/** The final word on a mail card, whoever sent it; undefined until it has ended. */
export function mailOutcomeLabel(mail: MailApproval | undefined): string | undefined {
  const draft = mail?.tool === "mail_draft";
  switch (mail?.outcome) {
    case "sent":
      return t("Sent");
    case "saved":
      return t("Draft saved");
    case "failed":
      return draft ? t("Draft not saved") : t("Not sent");
    case "unknown":
      return t("Not confirmed");
    default:
      return undefined;
  }
}
