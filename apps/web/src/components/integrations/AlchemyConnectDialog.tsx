import { Trans, useLingui } from "@lingui/react/macro";
import { rpc } from "../../lib/rpc";
import { ConnectionDialog } from "./ConnectionDialog";

/** Saves the Alchemy API key. The server checks the key and shows its error inline. */
export function AlchemyConnectDialog({
  onConnected,
  onClose,
}: {
  onConnected: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <ConnectionDialog
      title={<Trans>Connect Alchemy</Trans>}
      name="Alchemy"
      logo="/logos/alchemy.svg"
      fields={[
        {
          id: "apiKey",
          label: t`API key`,
          type: "password",
          help: {
            href: "https://dashboard.alchemy.com/apps",
            label: <Trans>Get an API key</Trans>,
          },
        },
      ]}
      submitLabel={<Trans>Save</Trans>}
      onSubmit={async ({ apiKey }) => {
        await rpc.finance.cryptoProviderConnect({ provider: "alchemy", apiKey: apiKey ?? "" });
        onConnected();
      }}
      onClose={onClose}
    />
  );
}
