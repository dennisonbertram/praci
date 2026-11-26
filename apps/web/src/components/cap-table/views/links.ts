/** Where a cap table record is opened: its profile, or its ledger with that record open. */
export function recordHref(kind: string, id: string): string {
  switch (kind) {
    case "stakeholder":
      return `/app/cap-table/stakeholders/${id}`;
    case "certificate":
      return `/app/cap-table/securities?certificate=${id}`;
    case "convertible":
      return `/app/cap-table/securities/convertibles?convertible=${id}`;
    case "option_grant":
      return `/app/cap-table/plans/grants?grant=${id}`;
    case "plan":
      return "/app/cap-table/plans/equity-plans";
    case "share_class":
      return "/app/cap-table/share-classes";
    default:
      return "/app/cap-table/overview";
  }
}
