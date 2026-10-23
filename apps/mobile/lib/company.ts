import type { CompanyReviewCandidate, CompanyReviewResolve } from "@rakazo/contracts";
import { SIDEBAR_PAGE_TEMPLATES } from "@rakazo/contracts";

export function mobileCompanyAvailable(): boolean {
  return SIDEBAR_PAGE_TEMPLATES.some(
    (template) =>
      template.key === "company" &&
      template.available &&
      (template.platforms as readonly string[]).includes("mobile"),
  );
}

export function companyReviewDecision(
  candidate: CompanyReviewCandidate,
  action: "confirm" | "reject",
  target = "",
  subjects: Record<string, string> = {},
  title?: string,
): CompanyReviewResolve | null {
  const base = { candidateId: candidate.id, version: candidate.version, action };
  if (action === "reject") return { ...base, action };
  if ((candidate.choices.length || candidate.allowSeparate) && !target) return null;
  if (
    target === "separate"
      ? !candidate.allowSeparate
      : target && !candidate.choices.some((choice) => choice.id === target)
  )
    return null;
  if (
    candidate.subjects.some(
      (subject) => !candidate.subjectChoices.some((choice) => choice.id === subjects[subject.ref]),
    )
  )
    return null;
  if (title !== undefined && (!candidate.editableTitle || !title.trim())) return null;
  return {
    ...base,
    action,
    separate: target === "separate",
    targetId: target && target !== "separate" ? target : undefined,
    subjects,
    ...(title === undefined ? {} : { title: title.trim() }),
  };
}

export function companyMonthOffset(month: string, offset: number): string {
  const value = new Date(`${month}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value.toISOString().slice(0, 7);
}

export function companyCanPause(status: string): boolean {
  return status === "running";
}
export function companyCanCancel(status: string): boolean {
  return !["cancelled", "cancelling", "completed", "partial", "failed", "discarded"].includes(
    status,
  );
}
