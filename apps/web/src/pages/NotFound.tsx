import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";
import { PageEmptyState } from "../components/PageEmptyState";

/** Any address the app does not know, including old links to removed chats. */
export function NotFoundPage() {
  return (
    <main className="grid h-full place-items-center bg-background" data-rakazo-page="not-found">
      <PageEmptyState
        icon={<FileQuestion className="size-8" aria-hidden="true" />}
        title={<Trans>Page not found</Trans>}
        description={<Trans>This link is wrong or the page is no longer available.</Trans>}
      >
        <Button render={<Link to="/app" />}>
          <Trans>Go to Praci</Trans>
        </Button>
      </PageEmptyState>
    </main>
  );
}
