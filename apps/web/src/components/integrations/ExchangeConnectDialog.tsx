import { Trans, useLingui } from "@lingui/react/macro";
import type { ExchangeProvider } from "@rakazo/contracts";
import { EXCHANGES } from "../../lib/integrations";
import { rpc } from "../../lib/rpc";
import { ConnectionDialog } from "./ConnectionDialog";

/** Saves a read-only Coinbase or Kraken API key. The server reads balances first and shows its error here. */
export function ExchangeConnectDialog({
  provider,
  onConnected,
  onClose,
}: {
  provider: ExchangeProvider;
  onConnected: () => void;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const exchange = EXCHANGES.find((e) => e.provider === provider) ?? EXCHANGES[0];
  const coinbase = provider === "coinbase";
  return (
    <ConnectionDialog
      title={<Trans>Connect {exchange.name}</Trans>}
      name={exchange.name}
      logo={exchange.logo}
      fields={[
        {
          id: "key",
          label: coinbase ? t`API key name` : t`API key`,
          help: {
            href: exchange.keyUrl,
            label: coinbase ? (
              <Trans>Create a read-only key</Trans>
            ) : (
              <Trans>Create a key with only Query Funds</Trans>
            ),
          },
        },
        { id: "secret", label: t`Private key`, type: "password" },
      ]}
      submitLabel={<Trans>Connect</Trans>}
      onSubmit={async ({ key, secret }) => {
        await rpc.finance.exchangeConnect({ provider, key: key ?? "", secret: secret ?? "" });
        onConnected();
      }}
      onClose={onClose}
    />
  );
}
