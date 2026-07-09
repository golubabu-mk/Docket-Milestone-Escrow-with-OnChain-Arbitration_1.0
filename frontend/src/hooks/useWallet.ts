"use client";

import { useCallback, useState } from "react";
import { openWalletSelector, disconnectWallet } from "@/lib/wallet";

export interface WalletState {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  balance: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnecting: false,
    error: null,
    balance: null,
  });

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const { Horizon } = await import("@stellar/stellar-sdk");
      const horizonServer = new Horizon.Server("https://horizon-testnet.stellar.org");
      const account = await horizonServer.loadAccount(address);
      const nativeBalance = account.balances.find((b: any) => b.asset_type === "native");
      setState((s) => ({ ...s, balance: nativeBalance ? nativeBalance.balance : "0" }));
    } catch (err) {
      console.error("Failed to fetch balance", err);
      setState((s) => ({ ...s, balance: "0" }));
    }
  }, []);

  const refreshBalance = useCallback(() => {
    if (state.address) {
      fetchBalance(state.address);
    }
  }, [state.address, fetchBalance]);

  const connect = useCallback(() => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    openWalletSelector(
      (address) => {
        setState({ address, isConnecting: false, error: null, balance: null });
        fetchBalance(address);
      },
      (message) => setState((s) => ({ ...s, isConnecting: false, error: message }))
    );
  }, [fetchBalance]);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setState({ address: null, isConnecting: false, error: null, balance: null });
  }, []);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return { ...state, connect, disconnect, dismissError, refreshBalance };
}
