"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Order } from "@/lib/types";
import { Check, Loader2, X, Edit2, Download } from "lucide-react";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import { cn, handleExport } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  delivered: "Delivered",
  returned: "Returned",
  failed: "Failed",
  canceled: "Canceled",
  shelved: "Shelved",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-purple-100 text-purple-900",
  delivered: "bg-emerald-100 text-emerald-900",
  returned: "bg-orange-100 text-orange-900",
  failed: "bg-red-100 text-red-900",
  canceled: "bg-slate-100 text-slate-900",
  shelved: "bg-amber-100 text-amber-900",
};

const PAYMENT_METHODS = ["Cash", "Transfer", "PBD"];
const BANK_OPTIONS = ["UBA", "moniepoint"];

export default function FOMOrdersPage() {
  const { user } = useAuth();
  const [foms, setFoms] = useState<any[]>([]);
  const [ccUsers, setCcUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Order | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  // Pause realtime while the user is editing a row, searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [dataLimit, setDataLimit] = useState(100);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const isInitialLoad = useRef(true);

  const fetchOrders = useCallback(async (payload?: any) => {
    if (!user?.uid) return;

    if (payload && payload.eventType) {
      const matchFilters = (order: Order) => {
        const matchesFom = order.fom_assigned === user.uid;
        const matchesStatus = order.status === "fom" || order.status === "accounting";
        const matchesMerchant = !filterMerchant || order.merchant === filterMerchant;
        const createdAt = new Date(order.created_at);
        const matchesStart = !startDate || createdAt >= new Date(`${startDate}T00:00:00Z`);
        const matchesEnd = !endDate || createdAt <= new Date(`${endDate}T23:59:59Z`);
        return matchesFom && matchesStatus && matchesMerchant && matchesStart && matchesEnd;
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
        .select("*", { count: "exact" });

      if (startDate) {
        ordersQuery = ordersQuery.gte("created_at", `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte("created_at", `${endDate}T23:59:59Z`);
      }

      const [
        { data: ordersData, count, error: fetchError },
        { data: merchantsData },
        { data: landmarkData },
        { data: fomUserData },
        { data: ccUserData },
      ] = await Promise.all([
        (() => {
          let q = ordersQuery
            .eq("fom_assigned", user.uid)
            .or("status.eq.fom, status.eq.accounting");
          if (filterMerchant) q = q.eq("merchant", filterMerchant);
          return q.order("created_at", { ascending: false }).limit(dataLimit);
        })(),
        supabase!
          .from("merchants")
          .select("name")
          .eq("is_active", true)
          .order("name"),
        supabase!
          .from("landmarks")
          .select("*")
          .eq("is_active", true)
          .order("name"),
        supabase!.from("users").select("id, display_name").eq("role", "fom"),
        supabase!
          .from("users")
          .select("id, display_name")
          .eq("role", "customer_service"),
      ]);

      if (fetchError) throw fetchError;

      if (merchantsData) {
        setMerchantOptions(merchantsData.map((m: any) => m.name));
      }
      if (landmarkData) {
        setLandmarks(landmarkData);
      }
      setOrders((ordersData ?? []) as Order[]);
      setTotalCount(count ?? 0);
      setFoms((fomUserData ?? []) as any[]);
      setCcUsers((ccUserData ?? []) as any[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load FOM orders.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.uid, dataLimit, startDate, endDate, filterMerchant]);

  useEffect(() => {
    if (!user?.uid) return;
    fetchOrders();
  }, [user?.uid, fetchOrders]);

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchOrders,
    [user?.uid, fetchOrders],
    realtimePaused,
  );

  const startEditing = useCallback((order: Order) => {
    setEditingId(order.id);
    setEditForm({ ...order });
  }, []);

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSave = async () => {
    if (!editForm || !supabase) return;

    const selectedLandmark = landmarks.find(
      (l) => l.name === editForm.landmark,
    );
    const landmarkPrice = selectedLandmark ? Number(selectedLandmark.price) : 0;
    const paymentToMerchant =
      Number((editForm.amount_paid as any) || 0) - landmarkPrice;
    const isDelivered =
      editForm.fom_delivery_status?.toLowerCase() === "delivered";

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase!
        .from("orders")
        .update({
          payment_method: editForm.payment_method?.toLowerCase(),
          bank: editForm.bank,
          fom_delivery_status: editForm.fom_delivery_status?.toLowerCase(),
          quantity_delivered: editForm.quantity_delivered,
          amount_paid: editForm.amount_paid,
          fom_comment: editForm.fom_comment,
          payment_to_merchant: paymentToMerchant,
          updated_at: new Date().toISOString(),
          ...(isDelivered ? { delivered_at: new Date().toISOString() } : {}),
        })
        .eq("id", editForm.id);

      if (updateError) {
        throw updateError;
      }

      setEditingId(null);
      setEditForm(null);
      setIsSaving(false);
      window.setTimeout(() => {
        // Force reload if realtime doesn't refresh immediately
        fetchOrders();
      }, 250);
      toast.success("Order updated successfully.");
    } catch (err) {
      setIsSaving(false);
      toast.error(
        err instanceof Error
          ? err.message
          : "Unable to save changes. Please try again.",
      );
    }
  };

  // Merchant filtering is now done server-side in the Supabase query.
  const ordersByMerchant = orders;

  const columns = useMemo<DataTableColumn[]>(
    () => [
      {
        key: "id",
        label: "Order ID",
        render: (row) => `#${String(row.id).split("-")[0]}`,
        getSearchableText: (row) => String(row.id).split("-")[0],
      },
      {
        key: "fom_assigned_at",
        label: "Fom Assigned At",
        render: (row) =>
          new Date(row.fom_assigned_at as any).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
        getSearchableText: (row) =>
          new Date(row.fom_assigned_at as any).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          }),
      },
      {
        key: "customer",
        label: "Customer / Address",
        render: (row, index, isEditing, editRow, openDialog) => (
          <div className="py-1">
            <div className="text-xs font-semibold truncate">
              {(row.customer_name as any) || "—"}
            </div>
            <button
              type="button"
              className="text-[10px] text-muted-foreground truncate hover:underline text-left w-full"
              onClick={() => openDialog?.(String(row.delivery_address ?? ""))}
              title="Click to view full address"
            >
              {(row.delivery_address as any) || "—"}
            </button>
          </div>
        ),
        getSearchableText: (row) =>
          `${(row as any).customer_name || ""} ${(row as any).delivery_address || ""}`,
      },
      {
        key: "items",
        label: "Product",
        render: (row) => (
          <div className="text-xs truncate">
            {((row.items as any[]) || [])
              .map((i) => `${i.quantity}x ${i.name}`)
              .join(", ") || "—"}
          </div>
        ),
        getSearchableText: (row) =>
          ((row.items as any[]) || []).map((i) => i.name).join(", "),
      },
      {
        key: "order_price",
        label: "TOtal Amount (₦)",
        render: (row) =>
          `₦${Number((row as any).total_amount || 0).toLocaleString()}`,
        getSearchableText: (row) =>
          String(Number((row as any).total_amount || 0)),
      },
      {
        key: "rider_info",
        label: "Rider / Landmark",
        render: (row) => (
          <div className="py-1">
            <div className="text-xs">{(row as any).rider_name || "—"}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {(row as any).landmark || "—"}
            </div>
          </div>
        ),
        getSearchableText: (row) =>
          `${(row as any).rider_name || ""} ${(row as any).landmark || ""}`,
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
        key: "payment_to_rider",
        label: "Rider Price (₦)",
        render: (row) =>
          `₦${Number((row as any).payment_to_rider || 0).toLocaleString()}`,
        getSearchableText: (row) =>
          String(Number((row as any).payment_to_rider || 0)),
      },
      {
        key: "fom_delivery_status",
        label: "Del. Status",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          if (isEditing && editForm?.fom_delivery_status !== "delivered") {
            return (
              <select
                value={editForm?.fom_delivery_status ?? "pending"}
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev
                      ? { ...prev, fom_delivery_status: e.target.value as any }
                      : prev,
                  )
                }
                className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            );
          }
          return (
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase whitespace-nowrap",
                STATUS_STYLES[(row as any).fom_delivery_status || "pending"],
              )}
            >
              {(row as any).fom_delivery_status || "pending"}
            </span>
          );
        },
        getSearchableText: (row) =>
          (row as any).fom_delivery_status || "pending",
      },
      {
        key: "payment_method",
        label: "Payment Method",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          if (isEditing) {
            return editForm?.payment_method ? (
              <span className="text-xs text-muted-foreground">
                {editForm.payment_method}
              </span>
            ) : (
              <select
                value={editForm?.payment_method ?? ""}
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev ? { ...prev, payment_method: e.target.value } : prev,
                  )
                }
                className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="">Select Method</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            );
          }
          return (row as any).payment_method || "—";
        },
        getSearchableText: (row) => (row as any).payment_method || "",
      },
      {
        key: "bank",
        label: "Bank",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          if (isEditing) {
            return (
              <select
                value={editForm?.bank ?? ""}
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev ? { ...prev, bank: e.target.value } : prev,
                  )
                }
                className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="">Select Bank</option>
                {BANK_OPTIONS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            );
          }
          return (row as any).bank || "—";
        },
        getSearchableText: (row) => (row as any).bank || "",
      },
      {
        key: "quantity_delivered",
        label: "Quantity Delivered",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          if (isEditing) {
            return (
              <Input
                className="h-7 w-full text-[10px]"
                type="number"
                placeholder="0"
                value={editForm?.quantity_delivered ?? ""}
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev
                      ? { ...prev, quantity_delivered: Number(e.target.value) }
                      : prev,
                  )
                }
              />
            );
          }
          return (row as any).quantity_delivered || "—";
        },
        getSearchableText: (row) => (row as any).quantity_delivered || "",
      },
      {
        key: "amount_paid",
        label: "Amount Paid (₦)",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          if (isEditing) {
            return (
              <Input
                className="h-7 w-full text-[10px]"
                type="number"
                placeholder="0"
                value={editForm?.amount_paid ?? ""}
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev
                      ? { ...prev, amount_paid: Number(e.target.value) }
                      : prev,
                  )
                }
              />
            );
          }
          return `₦${(row as any).amount_paid}` || "—";
        },
        getSearchableText: (row) => (row as any).amount_paid || "",
      },
      {
        key: "fom_comment",
        label: "Fom Comment",
        longText: true,
        render: (row) => {
          const isEditing = editingId === String(row.id);
          if (isEditing) {
            return (
              <Textarea
                value={editForm?.fom_comment ?? ""}
                placeholder="notes"
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev ? { ...prev, fom_comment: e.target.value } : prev,
                  )
                }
                className="min-h-12 text-xs py-1"
              />
            );
          }
          return (row as any).fom_comment || "—";
        },
        getSearchableText: (row) => (row as any).fom_comment || "",
      },
    ],
    [editingId, editForm],
  );

  const renderRowActions = useCallback(
    (row: any) => {
      const isEditing = editingId === String(row.id);
      return (
        <div className="flex justify-end gap-1">
          {isEditing ? (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleSave}
                disabled={isSaving}
                title="Save"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 text-emerald-500" />
                )}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={cancelEditing}
                disabled={isSaving}
                title="Cancel"
              >
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => startEditing(row as unknown as Order)}
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    },
    [editingId, isSaving, handleSave, startEditing],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Orders</h1>
          <p className="text-muted-foreground mt-2">
            History of fulfillment orders processed and completed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            <Button onClick={fetchOrders}>Refresh</Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              FOM workflow
            </h2>
            <p className="text-sm text-muted-foreground">
              Progress orders from packing to delivered status.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 px-4 py-2 text-sm text-foreground">
            {ordersByMerchant.length} active order
            {ordersByMerchant.length === 1 ? "" : "s"}
            {totalCount !== null && totalCount > orders.length ? ` (${totalCount} total in DB)` : ""}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Loading orders...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <DataTable
            headers={columns}
            rows={ordersByMerchant as any}
            merchantOptions={merchantOptions}
            filterMerchant={filterMerchant}
            onFilterMerchantChange={setFilterMerchant}
            searchPlaceholder="Search my orders..."
            showActions
            renderRowActions={renderRowActions}
            onUserActivityChange={setRealtimePaused}
            dataLimit={dataLimit}
            onDataLimitChange={setDataLimit}
            totalCount={totalCount ?? undefined}
          />
        )}
      </Card>
    </div>
  );
}
