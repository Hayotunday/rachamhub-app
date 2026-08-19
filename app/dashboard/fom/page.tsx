"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/auth-context";
import {
  Package,
  TrendingUp,
  Clock,
  CheckCircle2,
  Loader2,
  Check,
} from "lucide-react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { useGlobalStats } from "@/hooks/use-global-stats";
import { supabase } from "@/lib/supabase";
import { Order } from "@/lib/types";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

const PAYMENT_METHODS = ["Cash", "Transfer", "PBD"];
const DELIVERY_STATUSES = [
  "pending",
  "delivered",
  "returned",
  "failed",
  "canceled",
  "shelved",
];

export default function FOMDashboard() {
  const { user } = useAuth();
  const [riders, setRiders] = useState<string[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowInputs, setRowInputs] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [tempComment, setTempComment] = useState("");
  const [activeCommentOrderId, setActiveCommentOrderId] = useState<
    string | null
  >(null);
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  // Pause realtime while the user is editing a row, searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [dataLimit, setDataLimit] = useState(100);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { stats, refreshStats } = useGlobalStats(user?.uid);
  const isInitialLoad = useRef(true);

  const fetchData = useCallback(async (payload?: any) => {
    if (!user?.uid) return;

    if (payload && payload.eventType) {
      const matchFilters = (order: Order) => {
        const matchesFom = order.fom_assigned === user.uid;
        const matchesStatus = order.status === "warehouse";
        const matchesMerchant = !filterMerchant || order.merchant === filterMerchant;
        const matchesQueue = !order.rider_name && order.warehouse_status !== "out-of-stock" && (!order.fom_delivery_status || order.fom_delivery_status === "pending");
        const createdAt = new Date(order.created_at);
        const matchesStart = !startDate || createdAt >= new Date(`${startDate}T00:00:00Z`);
        const matchesEnd = !endDate || createdAt <= new Date(`${endDate}T23:59:59Z`);
        return matchesFom && matchesStatus && matchesMerchant && matchesQueue && matchesStart && matchesEnd;
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

    let ordersQuery = supabase!
      .from("orders")
      .select("id, created_at, fom_assigned_at, customer_name, delivery_address, items, total_amount, rider_name, payment_to_rider, landmark, payment_method, fom_delivery_status, fom_comment, status, fom_assigned, warehouse_status, merchant", { count: "exact" });

    if (startDate) {
      ordersQuery = ordersQuery.gte("created_at", `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte("created_at", `${endDate}T23:59:59Z`);
    }

    const [
      { data, count, error },
      { data: riderData },
      { data: landmarkData },
      { data: merchantData },
    ] = await Promise.all([
      (() => {
        let q = ordersQuery
          .eq("fom_assigned", user.uid)
          .eq("status", "warehouse")
          .is("rider_name", null)
          .neq("warehouse_status", "out-of-stock")
          .or("fom_delivery_status.is.null,fom_delivery_status.eq.pending");
        if (filterMerchant) q = q.eq("merchant", filterMerchant);
        return q.order("created_at", { ascending: false }).limit(dataLimit);
      })(),
      supabase!
        .from("riders")
        .select("name")
        .eq("is_active", true)
        .order("name"),
      supabase!
        .from("landmarks")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      supabase!
        .from("merchants")
        .select("name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (error) {
      toast.error(error.message);
    }

    setOrders((data ?? []) as Order[]);
    setTotalCount(count ?? 0);

    if (riderData) {
      setRiders(riderData.map((row: any) => row.name).filter(Boolean));
    }
    if (landmarkData) {
      setLandmarks(landmarkData);
    }
    if (merchantData) {
      setMerchantOptions(
        merchantData.map((row: any) => row.name).filter(Boolean),
      );
    }

    setLoading(false);
  }, [user?.uid, dataLimit, startDate, endDate, filterMerchant]);

  useEffect(() => {
    if (!user?.uid) return;

    fetchData();
  }, [user?.uid, fetchData]);

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchData,
    [user?.uid, fetchData],
    realtimePaused,
  );

  const updateRowInput = useCallback(
    (orderId: string, field: string, value: any) => {
      setRowInputs((prev) => ({
        ...prev,
        [orderId]: {
          ...(prev[orderId] || {}),
          [field]: value,
        },
      }));
    },
    [],
  );

  const openCommentModal = useCallback(
    (orderId: string, currentVal: string) => {
      setActiveCommentOrderId(orderId);
      setTempComment(currentVal);
      setCommentModalOpen(true);
    },
    [],
  );

  const handleSaveComment = useCallback(() => {
    if (activeCommentOrderId) {
      updateRowInput(activeCommentOrderId, "fom_comment", tempComment);
    }
    setCommentModalOpen(false);
  }, [activeCommentOrderId, tempComment, updateRowInput]);

  const handleFomSubmit = useCallback(
    async (order: Order) => {
      const inputs = rowInputs[order.id] || {};
      
      const isReturnedOrCanceled = 
        inputs.delivery_status === "returned" || 
        inputs.delivery_status === "canceled";

      if (!isReturnedOrCanceled && (!inputs.rider_name || !inputs.payment_to_rider || !inputs.landmark)) {
        toast.info("Required fields missing", {
          description: "Rider name, rider Price, and landmark are required.",
        });
        return;
      }

      setIsSubmitting(order.id);
      const riderPrice = Number(inputs.payment_to_rider) || 0;
      const isFailed = inputs.delivery_status?.toLowerCase() === "failed";
      const finalRiderPrice = isFailed ? riderPrice / 2 : riderPrice;

      const selectedLandmark = landmarks.find(
        (l) => l.name === inputs.landmark,
      );
      const landmarkPrice = selectedLandmark
        ? Number(selectedLandmark.price)
        : 0;
      const paymentByMerchant = 0; // Remains 0 until amount_paid is set

      try {
        const { error } = await supabase!
          .from("orders")
          .update({
            status: "fom",
            rider_name: inputs.rider_name || null,
            payment_to_rider: finalRiderPrice,
            landmark: inputs.landmark || null,
            payment_to_merchant: paymentByMerchant,
            fom_delivery_status: inputs.delivery_status?.toLowerCase(),
            payment_method: inputs.payment_method?.toLowerCase() || null,
            fom_comment: inputs.fom_comment || null,
            updated_at: new Date().toISOString(),
            rider_assigned_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (error) throw error;
        toast.success("Order submitted successfully");
        fetchData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit order");
        toast.error(
          err instanceof Error ? err.message : "Failed to submit order",
        );
      } finally {
        setIsSubmitting(null);
      }
    },
    [rowInputs, fetchData],
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
        longText: true,
        render: (row, index, isEditing, editRow, openDialog) => (
          <div className="py-1">
            <div className="text-xs font-semibold truncate">
              {row.customer_name as any}
            </div>
            <button
              type="button"
              className="text-[10px] text-muted-foreground truncate hover:underline text-left w-full"
              onClick={() => openDialog?.(String(row.delivery_address ?? ""))}
              title="Click to view full address"
            >
              {row.delivery_address as any}
            </button>
          </div>
        ),
        getSearchableText: (row) =>
          `${(row as any).customer_name || ""} ${(row as any).delivery_address || ""}`,
      },
      {
        key: "items",
        label: "Products",
        longText: true,
        render: (row) => (
          <div className="text-xs truncate">
            {((row.items as any[]) || [])
              .map((i) => `${i.quantity}x ${i.name}`)
              .join(", ")}
          </div>
        ),
        getSearchableText: (row) =>
          ((row.items as any[]) || []).map((i) => i.name).join(", "),
      },
      {
        key: "amount",
        label: "Total Amount (₦)",
        render: (row) => {
          const inputs = rowInputs[String(row.id)] || {};
          const selectedLandmark = landmarks.find(
            (l) => l.name === inputs.landmark,
          );
          const landmarkPrice = selectedLandmark
            ? Number(selectedLandmark.price)
            : 0;
          const paymentByMerchant =
            Number((row.total_amount as any) || 0) - landmarkPrice;
          return (
            <div className="py-1">
              <div className="text-xs">
                ₦{Number((row.total_amount as any) || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium truncate">
                To Merchant: ₦{paymentByMerchant.toLocaleString()}
              </div>
            </div>
          );
        },
        getSearchableText: (row) => {
          const inputs = rowInputs[String(row.id)] || {};
          const selectedLandmark = landmarks.find(
            (l) => l.name === inputs.landmark,
          );
          const landmarkPrice = selectedLandmark
            ? Number(selectedLandmark.price)
            : 0;
          const paymentByMerchant =
            Number((row.total_amount as any) || 0) - landmarkPrice;
          return `${Number((row.total_amount as any) || 0)} ${paymentByMerchant}`;
        },
      },
      {
        key: "rider_name",
        label: "Rider Name",
        render: (row) => (
          <select
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-[10px]"
            value={rowInputs[String(row.id)]?.rider_name || ""}
            onChange={(e) =>
              updateRowInput(String(row.id), "rider_name", e.target.value)
            }
          >
            <option value="">Select Rider</option>
            {riders.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ),
        getSearchableText: (row) => rowInputs[String(row.id)]?.rider_name || "",
      },
      {
        key: "payment_to_rider",
        label: "Rider Price (₦)",
        render: (row) => (
          <Input
            className="h-7 w-full text-[10px]"
            type="number"
            placeholder="0"
            value={rowInputs[String(row.id)]?.payment_to_rider || ""}
            onChange={(e) =>
              updateRowInput(String(row.id), "payment_to_rider", e.target.value)
            }
          />
        ),
        getSearchableText: (row) =>
          String(rowInputs[String(row.id)]?.payment_to_rider || ""),
      },
      {
        key: "landmark",
        label: "Landmark",
        render: (row) => (
          <select
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-[10px]"
            value={rowInputs[String(row.id)]?.landmark || ""}
            onChange={(e) =>
              updateRowInput(String(row.id), "landmark", e.target.value)
            }
          >
            <option value="">Select Landmark</option>
            {landmarks.map((l) => (
              <option key={l.id} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        ),
        getSearchableText: (row) => rowInputs[String(row.id)]?.landmark || "",
      },
      {
        key: "payment_method",
        label: "Payment Method",
        render: (row) => (
          <select
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-[10px]"
            value={rowInputs[String(row.id)]?.payment_method || ""}
            onChange={(e) =>
              updateRowInput(String(row.id), "payment_method", e.target.value)
            }
          >
            <option value="">Method</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ),
        getSearchableText: (row) =>
          rowInputs[String(row.id)]?.payment_method || "",
      },
      {
        key: "delivery_status",
        label: "Delivery Status",
        render: (row) => (
          <select
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-[10px]"
            value={rowInputs[String(row.id)]?.delivery_status || ""}
            onChange={(e) =>
              updateRowInput(String(row.id), "delivery_status", e.target.value)
            }
          >
            <option value="">Select status</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ),
        getSearchableText: (row) =>
          rowInputs[String(row.id)]?.delivery_status || "",
      },
      {
        key: "fom_comment",
        label: "FOM Comment",
        render: (row) => (
          <Input
            className="h-7 w-full text-[10px] cursor-pointer"
            placeholder="Note..."
            value={rowInputs[String(row.id)]?.fom_comment || ""}
            readOnly
            onClick={() =>
              openCommentModal(
                String(row.id),
                rowInputs[String(row.id)]?.fom_comment || "",
              )
            }
          />
        ),
        getSearchableText: (row) =>
          rowInputs[String(row.id)]?.fom_comment || "",
      },
    ],
    [rowInputs, riders, landmarks, openCommentModal, updateRowInput],
  );

  // All queue + merchant filtering is now done server-side in the Supabase query,
  // so orders already contains only the matching rows.
  const actionableOrdersByMerchant = orders;

  const renderRowActions = useCallback(
    (row: any) => {
      const orderId = String(row.id);
      const inputs = rowInputs[orderId] || {};
      
      const isReturnedOrCanceled = 
        inputs.delivery_status === "returned" || 
        inputs.delivery_status === "canceled";

      const isComplete = Boolean(
        inputs.rider_name && inputs.payment_to_rider && inputs.landmark,
      );

      const canSubmit = isComplete || isReturnedOrCanceled;

      return (
        <div className="flex justify-start">
          <Button
            size="sm"
            className="h-7 px-3 text-[10px]"
            disabled={isSubmitting === orderId || !canSubmit}
            onClick={() => {
              toast.warning(
                "Please cross-check values. Once submitted, the order moves to accounting and cannot be edited here.",
                {
                  action: {
                    label: "Proceed",
                    onClick: () => handleFomSubmit(row as unknown as Order),
                  },
                  duration: 6000,
                },
              );
            }}
          >
            {isSubmitting === orderId ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            <span className="ml-1">Submit</span>
          </Button>
        </div>
      );
    },
    [rowInputs, isSubmitting, handleFomSubmit],
  );

  const fomLevel = user?.role.toUpperCase() || "FOM";
  const assignedOrders = stats.fom_assigned;
  const inProgress = stats.fom_in_progress;
  const readyForDelivery = stats.fom_ready;
  const completedToday = stats.fom_completed_today;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {fomLevel} Fulfillment Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage order fulfillment operations.
        </p>
      </div>

      {loading ? (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading fulfillment metrics...
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Assigned Orders
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {assignedOrders}
                </p>
              </div>
              <Package className="h-6 w-6 text-primary" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  In Progress
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {inProgress}
                </p>
              </div>
              <TrendingUp className="h-6 w-6 text-secondary" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Pending Delivery
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {readyForDelivery}
                </p>
              </div>
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Completed Today
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {completedToday}
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
          </Card>
        </div>
      )}

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

      <Card className="p-6">
        <DataTable
          title="New Orders Queue"
          headers={columns}
          rows={actionableOrdersByMerchant as any}
          merchantOptions={merchantOptions}
          filterMerchant={filterMerchant}
          onFilterMerchantChange={setFilterMerchant}
          searchPlaceholder="Search queue..."
          showActions
          renderRowActions={renderRowActions}
          onUserActivityChange={setRealtimePaused}
          dataLimit={dataLimit}
          onDataLimitChange={setDataLimit}
          totalCount={totalCount ?? undefined}
        />
      </Card>

      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="sm:max-w-131.25">
          <DialogHeader>
            <DialogTitle>Add Order Comment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Enter detailed comment or delivery instructions..."
              className="min-h-37.5"
              value={tempComment}
              onChange={(e) => setTempComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveComment}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
