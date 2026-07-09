export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const BOUNTY_BOARD_CONTRACT_ID =
  process.env.NEXT_PUBLIC_BOUNTY_BOARD_CONTRACT_ID ?? "";

export const CONTRIBUTOR_REGISTRY_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRIBUTOR_REGISTRY_CONTRACT_ID ?? "";

export const REWARD_TOKEN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_REWARD_TOKEN_CONTRACT_ID ?? "";

export const EXPLORER_TX_URL = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;

export const EXPLORER_CONTRACT_URL = (id: string) =>
  `https://stellar.expert/explorer/testnet/contract/${id}`;

export function isConfigured(): boolean {
  return Boolean(BOUNTY_BOARD_CONTRACT_ID && CONTRIBUTOR_REGISTRY_CONTRACT_ID);
}
