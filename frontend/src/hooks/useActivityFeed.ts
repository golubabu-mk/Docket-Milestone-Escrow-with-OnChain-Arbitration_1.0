"use client";

import { useCallback, useState } from "react";
import { ActivityEvent } from "@/lib/types";

const MAX_EVENTS = 30;

/**
 * Client-side activity feed. Each successful contract call pushes an
 * event here immediately (optimistic), giving the "live ticker" feel
 * the design calls for. In production this would also subscribe to
 * `getEvents` on the Soroban RPC server for events emitted by other
 * users' transactions — see docs/ARCHITECTURE.md for the polling
 * design that fills that gap between polls of list_bounties().
 */
export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const pushEvent = useCallback((event: Omit<ActivityEvent, "id">) => {
    setEvents((prev) => {
      const withId: ActivityEvent = { ...event, id: `${event.timestamp}-${Math.random()}` };
      return [withId, ...prev].slice(0, MAX_EVENTS);
    });
  }, []);

  return { events, pushEvent };
}
