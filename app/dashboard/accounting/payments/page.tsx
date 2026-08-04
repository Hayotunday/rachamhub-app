"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Order } from "@/lib/types";
import { Download, Loader2 } from "lucide-react";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import OrderSearchFilter from "@/components/order-search-filter";
import { Button } from "@/components/ui/button";
import { handleExport } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [foms, setFoms] = useState<any[]>([]);
  const [ccUsers, setCcUsers] = useState<any[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pause realtime while the user is searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [dataLimit, setDataLimit] = useState(100);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let ordersQuery = supabase!
        .from("orders")
        .select("*", { count: "exact" });

      if (startDate) {
        ordersQuery = ordersQuery.gte("created_at", `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte("created_at", `${endDate}T23:59:59Z`);
      }

      const [
        { data: ordersData, count, error: fetchError },
        { data: landmarksData },
        { data: fomUserData },
        { data: ccUserData },
      ] = await Promise.all([
        ordersQuery
          .eq("payment_confirmed", true)
          .order("updated_at", { ascending: false })
          .limit(dataLimit),
        supabase!.from("landmarks").select("*").eq("is_active", true),
        supabase!.from("users").select("id, display_name").eq("role", "fom"),
        supabase!
          .from("users")
          .select("id, display_name")
          .eq("role", "customer_service"),
      ]);

      if (fetchError) {
        throw fetchError;
      }

      setOrders((ordersData ?? []) as Order[]);
      setTotalCount(count ?? 0);
      setLandmarks((landmarksData ?? []) as any[]);
      setFoms((fomUserData ?? []) as any[]);
      setCcUsers((ccUserData ?? []) as any[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }, [dataLimit, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: DataTableColumn[] = [
    {
      key: "id",
      label: "Order ID",
      render: (row) => `#${String(row.id).split("-")[0]}`,
      getSearchableText: (row) => String(row.id).split("-")[0],
    },
    {
      key: "payment_verified_at",
      label: "Verified At",
      render: (row) =>
        (row.payment_verified_at as string)
          ? new Date(row.payment_verified_at as string).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—",
      getSearchableText: (row) =>
        (row.payment_verified_at as string)
          ? new Date(row.payment_verified_at as string).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—",
    },
    {
      key: "delivered_at",
      label: "Delivered At",
      render: (row) =>
        (row as any).delivered_at
          ? new Date((row as any).delivered_at).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—",
      getSearchableText: (row) =>
        (row as any).delivered_at
          ? new Date((row as any).delivered_at).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "",
    },
    {
      key: "customer_name",
      label: "Customer",
      longText: true,
      render: (row) => (row.customer_name as any) || "—",
      getSearchableText: (row) => (row.customer_name as any) || "",
    },
    {
      key: "fom_assigned",
      label: "FOM Assigned",
      render: (row) =>
        foms.find((user) => user.id === (row as any).fom_assigned)
          ?.display_name || "—",
      getSearchableText: (row) =>
        foms.find((user) => user.id === (row as any).fom_assigned)
          ?.display_name || "",
    },
    {
      key: "amount_paid",
      label: "Amount Paid",
      render: (row) => `₦${Number(row.amount_paid || 0).toLocaleString()}`,
      getSearchableText: (row) => String(Number(row.amount_paid || 0)),
    },
    {
      key: "total_amount",
      label: "Order Amount",
      render: (row) => `₦${Number(row.total_amount || 0).toLocaleString()}`,
      getSearchableText: (row) => String(Number(row.total_amount || 0)),
    },
    {
      key: "quantity_delivered",
      label: "Quantity Delivered",
      render: (row) => Number(row.quantity_delivered || 0).toLocaleString(),
      getSearchableText: (row) => String(Number(row.quantity_delivered || 0)),
    },
    {
      key: "merchant",
      label: "Merchant",
      longText: true,
      render: (row) => (row.merchant as any) || "—",
      getSearchableText: (row) => (row.merchant as any) || "",
    },
    {
      key: "payment_to_merchant",
      label: "Payment To Merchant",
      longText: true,
      render: (row) =>
        `₦${Number(row.payment_to_merchant || 0).toLocaleString()}`,
      getSearchableText: (row) => String(Number(row.payment_to_merchant || 0)),
    },
    {
      key: "landmark",
      label: "Landmark",
      render: (row) => (row.landmark as any) || "—",
      getSearchableText: (row) => (row.landmark as any) || "",
    },
    {
      key: "landmark_price",
      label: "Landmark Price",
      render: (row) =>
        `₦${
          landmarks
            .find((l) => l.name === (row as any).landmark)
            ?.price?.toLocaleString() || "—"
        }`,
      getSearchableText: (row) =>
        String(
          landmarks.find((l) => l.name === (row as any).landmark)?.price || "",
        ),
    },
    {
      key: "rider_name",
      label: "Rider",
      longText: true,
      render: (row) => (row.rider_name as any) || "—",
      getSearchableText: (row) => (row.rider_name as any) || "",
    },
    {
      key: "payment_to_rider",
      label: "Rider Fee",
      render: (row) => `₦${Number(row.payment_to_rider || 0).toLocaleString()}`,
      getSearchableText: (row) => String(Number(row.payment_to_rider || 0)),
    },
    {
      key: "payment_bank",
      label: "Bank",
      render: (row) => (row as any).bank || "—",
      getSearchableText: (row) => (row.bank as any) || "",
    },
    {
      key: "payment_method",
      label: "Payment Method",
      render: (row) => (row as any).payment_method || "—",
      getSearchableText: (row) => (row.payment_method as any) || "",
    },
    {
      key: "fom_comment",
      label: "FOM Comment",
      render: (row) => (row.fom_comment as any) || "—",
      getSearchableText: (row) => (row.fom_comment as any) || "",
    },
  ];

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchData,
    [startDate, endDate],
    realtimePaused,
  );

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      if (filterMerchant && order.merchant !== filterMerchant) return false;
      if (!term) return true;
      return (
        (order.customer_name || "").toLowerCase().includes(term) ||
        (order.id || "").toLowerCase().includes(term) ||
        (order.merchant || "").toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm, filterMerchant]);

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground mt-2">
            Review confirmed payments and completed orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <ExportButton
            disabled={loading || orders.length === 0}
            onExport={async (start, end, type) =>
              await handleExport(foms, ccUsers, type, start, end)
            }
          />
        </div>
      </div>

      <Card className="p-6 mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex items-end justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Clear dates
            </Button>
            <Button onClick={fetchData}>Refresh</Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading payment records...
          </p>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-destructive/10 text-destructive">{error}</Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-6 text-muted-foreground">
          No verified payment records found.
        </Card>
      ) : (
        <Card className="overflow-hidden p-6">
          <DataTable
            headers={columns}
            rows={filteredOrders as any}
            searchPlaceholder="Search payments..."
            merchantOptions={[]}
            filterMerchant={filterMerchant}
            onFilterMerchantChange={setFilterMerchant}
            onUserActivityChange={setRealtimePaused}
            dataLimit={dataLimit}
            onDataLimitChange={setDataLimit}
            totalCount={totalCount ?? undefined}
          />
        </Card>
      )}
    </div>
  );
}
