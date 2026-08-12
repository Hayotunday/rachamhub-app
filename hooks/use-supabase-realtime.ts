import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

interface RealtimeSubscriptionConfig {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  filter?: string;
}

/**
 * Subscribes to Supabase realtime events and calls `callback` on any matching change.
 *
 * @param subscriptions - The tables/events to subscribe to.
 * @param callback      - Invoked when a realtime event fires (and the hook is not paused).
 * @param deps          - Additional dependencies that trigger re-subscription.
 * @param paused        - When `true`, incoming events are silently dropped but a
 *                        "pending refresh" flag is set internally. As soon as `paused`
 *                        returns to `false`, the callback is invoked once to catch up
 *                        with any changes that arrived while the user was busy.
 */
export function useSupabaseRealtime(
  subscriptions: RealtimeSubscriptionConfig[],
  callback: (payload?: RealtimePostgresChangesPayload<any>) => void | Promise<void>,
  deps: React.DependencyList = [],
  paused: boolean = false,
) {
  const callbackRef = useRef(callback);
  const pausedRef = useRef(paused);
  // Tracks whether at least one realtime event arrived while we were paused
  const pendingRefreshRef = useRef(false);

  // Keep refs in sync with the latest values without re-subscribing
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const wasPaused = pausedRef.current;
    pausedRef.current = paused;

    // If we just un-paused and missed at least one event, do a catch-up fetch
    if (wasPaused && !paused && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      callbackRef.current();
    }
  }, [paused]);

  useEffect(() => {
    if (!supabase) {
      console.error("Supabase client is not initialized for realtime hook.");
      return;
    }

    const channels: RealtimeChannel[] = [];

    subscriptions.forEach((subConfig, index) => {
      // Ensure channel names are unique and descriptive
      const channelName = `realtime_channel_${subConfig.table}_${subConfig.event}_${subConfig.filter || "nofilter"}_${index}`;

      const channel = supabase!
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: subConfig.event,
            schema: subConfig.schema || "public",
            table: subConfig.table,
            filter: subConfig.filter,
          } as any,
          (_payload: RealtimePostgresChangesPayload<any>) => {
            if (pausedRef.current) {
              // User is actively editing / searching — queue a refresh for later
              pendingRefreshRef.current = true;
            } else {
              callbackRef.current(_payload);
            }
          },
        )
        .subscribe();
      channels.push(channel);
    });

    return () => {
      channels.forEach((channel) => {
        supabase!.removeChannel(channel);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, ...deps, JSON.stringify(subscriptions)]);
}
