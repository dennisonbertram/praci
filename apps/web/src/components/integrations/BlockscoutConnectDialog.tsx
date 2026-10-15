import { Trans, useLingui } from "@lingui/react/macro";
import { rpc } from "../../lib/rpc";
import { ConnectionDialog } from "./ConnectionDialog";

/** Saves the Blockscout API key; used by the Integrations tile and the crypto page. */
export function BlockscoutConnectDialog({
  onConnected,
  onClose,
}: {
  onConnected: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  return (
    <ConnectionDialog
      title={<Trans>Connect Blockscout</Trans>}
      name="Blockscout"
      logo={null}
      fields={[
        {
          id: "apiKey",
          label: t`API key`,
          type: "password",
          help: { href: "https://dev.blockscout.com", label: <Trans>Get an API key</Trans> },
        },
      ]}
      submitLabel={<Trans>Save</Trans>}
      onSubmit={async ({ apiKey }) => {
        await rpc.finance.cryptoConnect({ apiKey });
        onConnected();
      }}
      onClose={onClose}
    />
  );
}
