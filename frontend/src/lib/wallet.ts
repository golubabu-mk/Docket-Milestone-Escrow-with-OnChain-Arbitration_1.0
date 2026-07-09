import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  ISupportedWallet,
} from "@creit.tech/stellar-wallets-kit";
import { NETWORK_PASSPHRASE } from "./config";

let kit: StellarWalletsKit | null = null;

function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network:
        NETWORK_PASSPHRASE.includes("Public")
          ? WalletNetwork.PUBLIC
          : WalletNetwork.TESTNET,
      selectedWalletId: "freighter",
      modules: allowAllModules(),
    });
  }
  return kit;
}

export async function openWalletSelector(
  onSelect: (address: string) => void,
  onError: (message: string) => void
): Promise<void> {
  const walletsKit = getKit();
  try {
    await walletsKit.openModal({
      onWalletSelected: async (option: ISupportedWallet) => {
        try {
          walletsKit.setWallet(option.id);
          const { address } = await walletsKit.getAddress();
          onSelect(address);
        } catch (err) {
          onError(
            err instanceof Error ? err.message : "Could not read wallet address."
          );
        }
      },
    });
  } catch (err) {
    onError(err instanceof Error ? err.message : "Wallet selector failed to open.");
  }
}

export async function signTransactionXdr(xdr: string): Promise<string> {
  const walletsKit = getKit();
  const { signedTxXdr } = await walletsKit.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}

export async function disconnectWallet(): Promise<void> {
  const walletsKit = getKit();
  await walletsKit.disconnect();
}
