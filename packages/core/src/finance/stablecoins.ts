// Stablecoins that count as cash. Identified by chain id + contract address, never by symbol:
// scam tokens copy symbols. Addresses are lowercase.
//
// Sources (issuer docs, checked 2026-10-14):
// - USDC: Circle, https://developers.circle.com/stablecoins/usdc-contract-addresses
// - USDT (Ethereum): Tether, https://tether.to/en/supported-protocols
// - USDT0 on Arbitrum, Optimism, Polygon (Tether's multichain USDT): https://docs.usdt0.to/technical-documentation/deployments
// - DAI (Ethereum): Sky chainlog MCD_DAI, https://chainlog.skyeco.com/api/mainnet/active.json
//
// Not included, because no issuer page lists them: bridged USDC.e (Arbitrum, Optimism, Polygon),
// USDbC (Base), DAI on L2s, and USDT on Base. Add one only with an issuer source.
const STABLECOINS: Record<number, readonly string[]> = {
  1: [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  ],
  8453: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"], // USDC
  42161: [
    "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT0
  ],
  10: [
    "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC
    "0x01bff41798a0bcf287b996046ca68b395dbc1071", // USDT0
  ],
  137: [
    "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC
    "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT0
  ],
};

/** True for a canonical stablecoin contract on a tracked chain. A native coin (null address) is never one. */
export function isStablecoin(chainId: number, tokenAddress: string | null): boolean {
  return (
    tokenAddress !== null && (STABLECOINS[chainId]?.includes(tokenAddress.toLowerCase()) ?? false)
  );
}
