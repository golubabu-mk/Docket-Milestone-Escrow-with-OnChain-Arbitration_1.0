"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listBounties } from "@/lib/soroban";
import { Bounty, ContractCallError } from "@/lib/types";
import { isConfigured } from "@/lib/config";

interface BountiesState {
  bounties: Bounty[];
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: number | null;
}

const POLL_INTERVAL_MS = 8000;

export function useBounties() {
  const [state, setState] = useState<BountiesState>({
    bounties: [],
    isLoading: true,
    error: null,
    lastSyncedAt: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBounties = useCallback(async (showSpinner: boolean) => {
    if (!isConfigured()) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error:
          "Contract addresses aren't configured yet. Set NEXT_PUBLIC_BOUNTY_BOARD_CONTRACT_ID in your environment.",
      }));
      return;
    }
    setState((s) => ({ ...s, isLoading: showSpinner, error: null }));
    try {
      const result = await listBounties(0, 50);
      setState({
        bounties: result.reverse(),
        isLoading: false,
        error: null,
        lastSyncedAt: Date.now(),
      });
    } catch (err) {
      const message =
        err instanceof ContractCallError
          ? err.message
          : "Couldn't load bounties from the network. Retrying shortly.";
      setState((s) => ({ ...s, isLoading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    fetchBounties(true);
    intervalRef.current = setInterval(() => fetchBounties(false), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBounties]);

  const refresh = useCallback(() => fetchBounties(false), [fetchBounties]);

  return { ...state, refresh };
}
