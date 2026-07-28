import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface GlobalStats {
  total_orders: number;
  delivered_orders: number;
  failed_orders: number;
  total_revenue: number;
  total_owed: number;
  total_fees: number;
  fom_assigned: number;
  fom_in_progress: number;
  fom_ready: number;
  fom_completed_today: number;
  accounting_revenue: number;
  accounting_pending: number;
  accounting_confirmed: number;
}

const defaultStats: GlobalStats = {
  total_orders: 0,
  delivered_orders: 0,
  failed_orders: 0,
  total_revenue: 0,
  total_owed: 0,
  total_fees: 0,
  fom_assigned: 0,
  fom_in_progress: 0,
  fom_ready: 0,
  fom_completed_today: 0,
  accounting_revenue: 0,
  accounting_pending: 0,
  accounting_confirmed: 0,
};

export function useGlobalStats(userId?: string | null) {
  const [stats, setStats] = useState<GlobalStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase!.rpc("get_global_stats", {
        fom_user_id: userId || null,
      });

      if (error) {
        // If the RPC function doesn't exist yet, it will throw an error.
        // We log it and keep the default stats so the app doesn't break.
        console.warn("Could not fetch global stats. Make sure the 'get_global_stats' RPC is created in Supabase.", error);
        setError(error.message);
      } else if (data) {
        setStats(data as GlobalStats);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch global stats.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();

    // Subscribe to realtime updates on the orders table
    const channel = supabase!
      .channel("global_stats_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [fetchStats]);

  return { stats, loading, error, refreshStats: fetchStats };
}
