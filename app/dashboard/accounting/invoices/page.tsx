"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import { Order } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-purple-100 text-purple-900",
  delivered: "bg-emerald-100 text-emerald-900",
  returned: "bg-orange-100 text-orange-900",
  failed: "bg-red-100 text-red-900",
  canceled: "bg-slate-100 text-slate-900",
  shelved: "bg-amber-100 text-amber-900",
};

export default function InvoicesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [foms, setFoms] = useState<any[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<
    Record<string, { confirmed: string; bank: string }>
  >({});
  // Pause realtime while the user is searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const PAGE_SIZE = 100;
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const isInitialLoad = useRef(true);

  const fetchData = useCallback(async (payload?: any) => {
    if (payload && payload.eventType) {
      const matchFilters = (order: Order) => {
        const matchesStatus = order.status === "fom";
        const matchesRider = order.rider_name !== null && order.rider_name !== "";
        const matchesMerchant = !filterMerchant || order.merchant === filterMerchant;
        const createdAt = new Date(order.created_at);
        const matchesStart = !startDate || createdAt >= new Date(`${startDate}T00:00:00Z`);
        const matchesEnd = !endDate || createdAt <= new Date(`${endDate}T23:59:59Z`);
        return matchesStatus && matchesRider && matchesMerchant && matchesStart && matchesEnd;
      };

      if (payload.eventType === "INSERT") {
        if (matchFilters(payload.new)) {
          setOrders((prev) => {
            if (prev.some((o) => o.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          setTotalCount((c) => (c !== null ? c + 1 : 1));
        }
      } else if (payload.eventType === "UPDATE") {
        if (matchFilters(payload.new)) {
          setOrders((prev) =>
            prev.map((o) => (o.id === payload.new.id ? payload.new : o))
          );
        } else {
          setOrders((prev) => {
            const exists = prev.some((o) => o.id === payload.new.id);
            if (exists) {
              setTotalCount((c) => (c !== null ? Math.max(0, c - 1) : 0));
              return prev.filter((o) => o.id !== payload.new.id);
            }
            return prev;
          });
        }
      } else if (payload.eventType === "DELETE") {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === payload.old.id);
          if (exists) {
            setTotalCount((c) => (c !== null ? Math.max(0, c - 1) : 0));
            return prev.filter((o) => o.id !== payload.old.id);
          }
          return prev;
        });
      }
      return;
    }

    if (isInitialLoad.current) {
      setLoading(true);
      isInitialLoad.current = false;
    }
    setError(null);

    try {
      let ordersQuery = supabase!
        .from("orders")
        .select("id, created_at, rider_assigned_at, delivered_at, inventory_status, fom_delivery_status, customer_name, items, fom_assigned, amount_paid, total_amount, quantity_delivered, merchant, payment_to_merchant, landmark, rider_name, payment_to_rider, payment_method, bank, fom_comment, payment_confirmed, status", { count: "exact" });

      if (startDate) {
        ordersQuery = ordersQuery.gte("created_at", `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte("created_at", `${endDate}T23:59:59Z`);
      }

      const [
        { data: ordersData, count, error: fetchError },
        { data: merchantsData },
        { data: landmarksData },
        { data: fomUserData },
      ] = await Promise.all([
        (() => {
          let q = ordersQuery
            .eq("status", "fom")
            .neq("rider_name", null);
          if (filterMerchant) q = q.eq("merchant", filterMerchant);
          return q.order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1);
        })(),
        supabase!
          .from("merchants")
          .select("name")
          .eq("is_active", true)
          .order("name"),
        supabase!.from("landmarks").select("*"),
        supabase!.from("users").select("id, display_name").eq("role", "fom"),
      ]);

      if (fetchError) throw fetchError;

      if (merchantsData)
        setMerchantOptions(merchantsData.map((m: any) => m.name));
      setOrders((ordersData ?? []) as Order[]);
      setTotalCount(count ?? 0);
      setLandmarks((landmarksData ?? []) as any[]);
      setFoms((fomUserData ?? []) as any[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterMerchant]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchData,
    [fetchData],
    realtimePaused,
  );

  const updateVerify = useCallback(
    (id: string, field: "confirmed" | "bank", value: string) => {
      setVerifications((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || { confirmed: "", bank: "" }),
          [field]: value,
        },
      }));
    },
    [],
  );

  const confirmPayment = useCallback(
    async (orderId: string) => {
      const verify = verifications[orderId];
      if (verify.confirmed === "false") {
        toast.error("Please confirm payment before proceeding.");
        return;
      }

      setActionLoading(orderId);
      try {
        const { error: updateError } = await supabase!
          .from("orders")
          .update({
            payment_confirmed: verify.confirmed === "true",
            status: "accounting",
            updated_at: new Date().toISOString(),
            payment_verified_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (updateError) throw updateError;

        toast.success("Payment verified successfully");
        await fetchData();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Unable to update payment status.",
        );
      } finally {
        setActionLoading(null);
      }
    },
    [verifications, fetchData],
  );

  const columns = useMemo<DataTableColumn[]>(
    () => [
      {
        key: "id",
        label: "Order ID",
        render: (row) => `#${String(row.id).split("-")[0]}`,
        getSearchableText: (row) => String(row.id).split("-")[0],
      },
      {
        key: "created_at",
        label: "Created At",
        render: (row) =>
          new Date(row.created_at as any).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
        getSearchableText: (row) =>
          new Date(row.created_at as any).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
      },
      {
        key: "rider_assigned_at",
        label: "Rider Assigned At",
        render: (row) =>
          new Date(row.rider_assigned_at as any).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
        getSearchableText: (row) =>
          new Date(row.rider_assigned_at as any).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
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
        key: "fom_delivery_status",
        label: "FOM Del. Status",
        render: (row) => (
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase whitespace-nowrap",
              STATUS_STYLES[(row.fom_delivery_status as any) || "pending"],
            )}
          >
            {(row.fom_delivery_status as any) || "pending"}
          </span>
        ),
        getSearchableText: (row) => (row.fom_delivery_status as any) || "",
      },
      {
        key: "inventory_status",
        label: "Inventory Del. Status",
        render: (row) =>

          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase whitespace-nowrap",
              STATUS_STYLES[(row.inventory_status as any) || "pending"],
            )}
          >
            {(row.inventory_status as any) || "pending"}
          </span>
        ,
        getSearchableText: (row) => (row.inventory_status as any) || "pending",
      },
      {
        key: "customer_name",
        label: "Customer Name",
        longText: true,
        render: (row) => (row.customer_name as any) || "—",
        getSearchableText: (row) => (row.customer_name as any) || "",
      },
      {
        key: "product_name",
        label: "Product Name",
        longText: true,
        render: (row) =>
          ((row.items as any[]) || []).map((i: any) => i.name).join(", "), // Display
        getSearchableText: (row) =>
          ((row.items as any[]) || []).map((i: any) => i.name).join(", "), // Searchable text
      },
      {
        key: "qty",
        label: "Qty",
        render: (row) =>
          ((row.items as any[]) || []).reduce(
            (acc: number, i: any) => acc + i.quantity,
            0,
          ),
        getSearchableText: (row) =>
          String(
            ((row.items as any[]) || []).reduce(
              (acc: number, i: any) => acc + i.quantity,
              0,
            ),
          ),
      },
      {
        key: "fom_assigned",
        label: "FOM Assigned",
        render: (row) =>
          foms.find((user) => user.id === (row as any).fom_assigned)
            ?.display_name || "—", // Display
        getSearchableText: (row) =>
          foms.find((user) => user.id === (row as any).fom_assigned)
            ?.display_name || "", // Searchable text
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
        getSearchableText: (row) =>
          String(Number(row.payment_to_merchant || 0)),
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
          `₦${landmarks
            .find((l) => l.name === (row as any).landmark)
            ?.price?.toLocaleString() || "—"
          }`,
        getSearchableText: (row) =>
          String(
            landmarks.find((l) => l.name === (row as any).landmark)?.price ||
            "",
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
        render: (row) =>
          `₦${Number(row.payment_to_rider || 0).toLocaleString()}`,
        getSearchableText: (row) => String(Number(row.payment_to_rider || 0)),
      },
      {
        key: "payment_method",
        label: "Payment Method",
        render: (row) => (row as any).payment_method || "—",
        getSearchableText: (row) => (row.payment_method as any) || "",
      },
      {
        key: "bank",
        label: "Bank",
        render: (row) => (row as any).bank || "—",
        getSearchableText: (row) => (row.bank as any) || "",
      },
      {
        key: "payment_verification",
        label: "Verify Payment",
        render: (row) => {
          const orderId = String(row.id);
          const currentVerification = verifications[orderId] || {
            confirmed: "",
          };

          return (
            <div className="flex flex-col gap-2 py-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Confirmed:</span>
                <select
                  className="h-7 rounded-md border border-input bg-background px-1 text-[10px]"
                  value={currentVerification.confirmed}
                  onChange={(e) =>
                    updateVerify(orderId, "confirmed", e.target.value)
                  }
                >
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          );
        },
        getSearchableText: (row) =>
          `${verifications[String(row.id)]?.confirmed === "true" ? "Confirmed" : "Not Confirmed"} ${verifications[String(row.id)]?.bank || ""}`,
      },
      {
        key: "fom_comment",
        label: "FOM Comment",
        render: (row) => (row.fom_comment as any) || "—",
        getSearchableText: (row) => (row.fom_comment as any) || "",
      },
      {
        key: "action",
        label: "Action",
        render: (row) => (
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={() => confirmPayment(String(row.id))}
            disabled={actionLoading === String(row.id)}
          >
            {actionLoading === String(row.id) ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Confirm Payment"
            )}
          </Button>
        ),
      },
    ],
    [
      verifications,
      actionLoading,
      updateVerify,
      confirmPayment,
      foms,
      landmarks,
    ],
  );

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    // Merchant filtering is done server-side
    return orders.filter((order) => {
      if (!term) return true;
      return (
        (order.customer_name || "").toLowerCase().includes(term) ||
        (order.id || "").toLowerCase().includes(term) ||
        (order.merchant || "").toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
        <p className="text-muted-foreground mt-2">
          Verify payments and manage financial records for delivered orders.
        </p>
      </div>

      <Card className="p-6 mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>From</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
              }}
              className="w-full"
            />
          </div>
          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
              }}
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
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading invoices...
          </p>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-destructive/10 border-destructive/30">
          <p className="text-destructive font-medium">Error loading invoices</p>
          <p className="text-sm text-destructive/80 mt-2">{error}</p>
        </Card>
      ) : (
        <Card className="p-6">
          <DataTable
            headers={columns}
            rows={filteredOrders as any}
            merchantOptions={merchantOptions}
            filterMerchant={filterMerchant}
            onFilterMerchantChange={setFilterMerchant}
            searchPlaceholder="Search invoices..."
            onUserActivityChange={setRealtimePaused}
            onLoadMore={async () => {
              const nextPage = page + 1;
              setLoadingMore(true);
              const from = nextPage * PAGE_SIZE;
              const to = from + PAGE_SIZE - 1;
              let q = supabase!.from("orders")
                .select("id, created_at, rider_assigned_at, delivered_at, customer_name, items, fom_assigned, amount_paid, total_amount, quantity_delivered, merchant, payment_to_merchant, landmark, rider_name, payment_to_rider, payment_method, bank, fom_comment, payment_confirmed, status")
                .eq("status", "fom")
                .neq("rider_name", null)
                .order("created_at", { ascending: false })
                .range(from, to);
              if (filterMerchant) q = q.eq("merchant", filterMerchant);
              if (startDate) q = q.gte("created_at", `${startDate}T00:00:00Z`);
              if (endDate) q = q.lte("created_at", `${endDate}T23:59:59Z`);
              const { data } = await q;
              if (data) { setOrders(prev => [...prev, ...data as Order[]]); setPage(nextPage); }
              setLoadingMore(false);
            }}
            loadingMore={loadingMore}
            totalCount={totalCount ?? undefined}
          />
        </Card>
      )}
    </div>
  );
}
