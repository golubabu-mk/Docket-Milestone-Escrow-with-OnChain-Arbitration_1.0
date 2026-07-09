"use client";

import { useCallback, useState } from "react";
import { openWalletSelector, disconnectWallet } from "@/lib/wallet";

export interface WalletState {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnecting: false,
    error: null,
  });

  const connect = useCallback(() => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    openWalletSelector(
      (address) => setState({ address, isConnecting: false, error: null }),
      (message) => setState((s) => ({ ...s, isConnecting: false, error: message }))
    );
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setState({ address: null, isConnecting: false, error: null });
  }, []);

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return { ...state, connect, disconnect, dismissError };
}
