"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth-context";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { supabase } from "@/lib/supabase";
import {
  Users,
  Package,
  Activity,
  BarChart3,
  Loader2,
  Layers,
  Settings,
} from "lucide-react";
import { useGlobalStats } from "@/hooks/use-global-stats";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { stats, refreshStats } = useGlobalStats();
  const [ordersCount, setOrdersCount] = useState(0);
  const [usersCount, setUsersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  const fetchAdminMetrics = useCallback(async () => {
    if (isInitialLoad.current) {
      setLoading(true);
      isInitialLoad.current = false;
    }
    const [{ count: orderCount }, { data: userData }] = await Promise.all([
      supabase!.from("orders").select("*", { count: "exact", head: true }),
      supabase!.from("users").select("id"),
    ]);
    setOrdersCount(orderCount ?? 0);
    setUsersCount((userData ?? []).length);
    refreshStats();
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAdminMetrics();
  }, [fetchAdminMetrics]);

  useSupabaseRealtime(
    [
      { table: "orders", event: "*" },
      { table: "users", event: "*" },
    ],
    fetchAdminMetrics,
    [fetchAdminMetrics],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Administration Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage users, system settings, and view company-wide metrics.
        </p>
      </div>

      {loading ? (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading admin metrics...
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Total Users
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {usersCount}
                </p>
              </div>
              <Users className="h-6 w-6 text-primary" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Total Orders
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {ordersCount}
                </p>
              </div>
              <Package className="h-6 w-6 text-secondary" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  System Health
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">Live</p>
              </div>
              <Activity className="h-6 w-6 text-emerald-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Revenue
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {formatCurrency(stats.total_revenue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  See Admin Orders for details
                </p>
              </div>
              <BarChart3 className="h-6 w-6 text-green-600" />
            </div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Administrative Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/admin/orders"
            className="block p-4 border border-border rounded-lg hover:bg-accent/50 transition"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground">
                  Order Master Table
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  View all orders, delete records, and export reports.
                </p>
              </div>
              <Layers className="h-6 w-6 text-primary" />
            </div>
          </Link>
          <Link
            href="/dashboard/admin/settings"
            className="block p-4 border border-border rounded-lg hover:bg-accent/50 transition"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground">
                  Merchant Management
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add, rename, and deactivate merchant records.
                </p>
              </div>
              <Settings className="h-6 w-6 text-secondary" />
            </div>
          </Link>
          <Link
            href="/dashboard/admin/users"
            className="block p-4 border border-border rounded-lg hover:bg-accent/50 transition"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground">User Management</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage accounts, roles, and access status.
                </p>
              </div>
              <Users className="h-6 w-6 text-emerald-500" />
            </div>
          </Link>
          <Link
            href="/dashboard/admin/settings"
            className="block p-4 border border-border rounded-lg hover:bg-accent/50 transition"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground">System Settings</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure order prefixes, timeouts, and FOM names.
                </p>
              </div>
              <Activity className="h-6 w-6 text-slate-600" />
            </div>
          </Link>
        </div>
      </Card>
    </div>
  );
}
