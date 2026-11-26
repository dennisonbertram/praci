/** Title of the needs_input notification that asks the owner to approve an action. Producers and readers share it. */
export const APPROVAL_TITLE_SUFFIX = " needs approval";

export const approvalTitle = (name: string) => `${name}${APPROVAL_TITLE_SUFFIX}`;

export const isApprovalTitle = (title: string) => title.endsWith(APPROVAL_TITLE_SUFFIX);
