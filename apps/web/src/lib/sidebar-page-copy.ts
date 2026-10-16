import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/** Translatable name and description for each template key in SIDEBAR_PAGE_TEMPLATES. */
const copy: Record<string, { label: MessageDescriptor; description: MessageDescriptor }> = {
  "team-health": {
    label: msg`Team health`,
    description: msg`Workload and key people, from your connected tools`,
  },
};

export const sidebarPageCopy = (key: string) =>
  copy[key] ?? { label: { id: key, message: key }, description: { id: "", message: "" } };
