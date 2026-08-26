"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, printTicket } from "@/lib/utils";
import { Order } from "@/lib/types";
import { Check, Edit2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import OrderSearchFilter from "@/components/order-search-filter";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export default function WarehouseOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fomUsers, setFomUsers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Order | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activeCommentOrderId, setActiveCommentOrderId] = useState<
    string | null
  >(null);
  const [tempComment, setTempComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ccUsers, setCcUsers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  // Pause realtime while the user is editing a row, searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const PAGE_SIZE = 100;
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const isInitialLoad = useRef(true);

  const fetchOrders = useCallback(async (payload?: any) => {
    if (payload && payload.eventType) {
      const matchFilters = (order: Order) => {
        const matchesStatus = true;
        const matchesAssign = order.status === "customer_service" || !order.fom_assigned;
        const matchesMerchant = !filterMerchant || order.merchant === filterMerchant;
        const createdAt = new Date(order.created_at);
        const matchesStart = !startDate || createdAt >= new Date(`${startDate}T00:00:00Z`);
        const matchesEnd = !endDate || createdAt <= new Date(`${endDate}T23:59:59Z`);
        return matchesStatus && matchesAssign && matchesMerchant && matchesStart && matchesEnd;
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
        .select("id, created_at, customer_name, delivery_address, phone_numbers, merchant, items, total_amount, warehouse_status, inventory_status, fom_assigned, warehouse_comment, cc_comment, extracted_by, status, prints", { count: "exact" });

      if (startDate) {
        ordersQuery = ordersQuery.gte("created_at", `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte("created_at", `${endDate}T23:59:59Z`);
      }

      const [
        { data: ordersData, count, error: fetchError },
        { data: ccUserData },
        { data: merchantsData },
        { data: fomUserData },
      ] = await Promise.all([
        (() => {
          let q = ordersQuery
            .or("status.eq.customer_service,fom_assigned.is.null");
          if (filterMerchant) q = q.eq("merchant", filterMerchant);
          return q.order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1);
        })(),
        supabase!
          .from("users")
          .select("id, display_name")
          .eq("role", "customer_service"),
        supabase!
          .from("merchants")
          .select("name")
          .eq("is_active", true)
          .order("name"),
        supabase!.from("users").select("id, display_name").eq("role", "fom"),
      ]);

      if (fetchError) throw fetchError;

      if (ccUserData) setCcUsers(ccUserData);
      if (merchantsData)
        setMerchantOptions(merchantsData.map((m: any) => m.name));
      if (fomUserData) setFomUsers(fomUserData);
      setOrders((ordersData ?? []) as Order[]);
      setTotalCount(count ?? 0);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterMerchant]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const startEditing = useCallback((order: Order) => {
    setEditingId(order.id);
    setEditForm({ ...order });
  }, []);

  const openCommentModal = useCallback(
    (orderId: string, currentVal: string) => {
      setActiveCommentOrderId(orderId);
      setTempComment(currentVal);
      setCommentModalOpen(true);
    },
    [],
  );

  const handleSaveComment = useCallback(() => {
    if (
      activeCommentOrderId &&
      editForm &&
      editForm.id === activeCommentOrderId
    ) {
      // Update the editForm's warehouse_comment with the tempComment
      setEditForm((prev) =>
        prev ? { ...prev, warehouse_comment: tempComment } : null,
      );
    }
    setCommentModalOpen(false);
  }, [activeCommentOrderId, editForm]);

  const columns = useMemo<DataTableColumn[]>(
    () => [
      {
        key: "id",
        label: "Order ID",
        render: (row) => `#${String(row.id || "").split("-")[0]}`,
        getSearchableText: (row) => String(row.id || "").split("-")[0],
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
        key: "customer_name",
        label: "Customer Name",
        render: (row) => (row.customer_name as any) || "—",
        getSearchableText: (row) => (row.customer_name as any) || "",
      },
      {
        key: "delivery_address",
        label: "Delivery Address",
        longText: true,
        render: (row) => (row.delivery_address as any) || "—",
        getSearchableText: (row) => (row.delivery_address as any) || "",
      },
      {
        key: "phone_numbers",
        label: "Phone",
        render: (row) =>
          ((row.phone_numbers as string[]) || []).join(", ") || "—",
        getSearchableText: (row) =>
          ((row.phone_numbers as string[]) || []).join(", "),
      },
      {
        key: "items",
        label: "Product Name",
        longText: true,
        render: (row) =>
          ((row.items as any[]) || [])
            .map((item: any) => `${item.quantity}x ${item.name}`)
            .join(", ") || "—",
        getSearchableText: (row) =>
          ((row.items as any[]) || []).map((item: any) => item.name).join(", "),
      },
      {
        key: "qty",
        label: "Qty",
        render: (row) =>
          ((row.items as any[]) || []).reduce(
            (total: number, item: any) => total + (item.quantity || 0),
            0,
          ) || "—",
        getSearchableText: (row) =>
          String(
            ((row.items as any[]) || []).reduce(
              (total: number, item: any) => total + (item.quantity || 0),
              0,
            ),
          ),
      },
      {
        key: "total_amount",
        label: "Amount (₦)",
        render: (row) =>
          `₦${Number((row.total_amount as any) || 0).toLocaleString()}`,
        getSearchableText: (row) =>
          String(Number((row.total_amount as any) || 0)),
      },
      {
        key: "merchant",
        label: "Merchant Name",
        render: (row) => (row.merchant as any) || "—",
        getSearchableText: (row) => (row.merchant as any) || "",
      },
      {
        key: "cc_comment",
        label: "CC Comment",
        longText: true,
        render: (row) => (row.cc_comment as any) || "—",
        getSearchableText: (row) => (row.cc_comment as any) || "",
      },
      {
        key: "inventory_status",
        label: "Delivery Status",
        render: (row) => (
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase whitespace-nowrap",
              STATUS_STYLES[(row.inventory_status as any) || "pending"],
            )}
          >
            {(row.inventory_status as any) || "pending"}
          </span>
        ),
        getSearchableText: (row) => (row.inventory_status as any) || "pending",
      },
      {
        key: "warehouse_status",
        label: "Warehouse Status",
        render: (row) =>
          editingId === String(row.id) ? (
            <select
              value={(editForm as any)?.warehouse_status || "Unpacked"}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev
                    ? {
                      ...prev,
                      warehouse_status: e.target.value as any,
                      fom_assigned:
                        e.target.value === "out-of-stock"
                          ? ""
                          : prev?.fom_assigned,
                    }
                    : null,
                )
              }
              className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px]"
            >
              <option value="unpacked">Unpacked</option>
              <option value="packed">Packed</option>
              <option value="out-of-stock">out of stock</option>
            </select>
          ) : (
            (row as any).warehouse_status || "Unpacked"
          ),
        getSearchableText: (row) => (row as any).warehouse_status || "Unpacked",
      },
      {
        key: "fom_assigned",
        label: "FOM Assigned",
        render: (row) =>
          editingId === String(row.id) ? (
            <select
              value={(editForm as any)?.fom_assigned || ""}
              disabled={(editForm as any)?.warehouse_status === "out-of-stock"}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev
                    ? { ...prev, fom_assigned: e.target.value as any }
                    : null,
                )
              }
              className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px]"
            >
              <option value="">Unassigned</option>
              {fomUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          ) : (
            fomUsers.find((u) => u.id === (row as any).fom_assigned)
              ?.display_name || "—"
          ),
        getSearchableText: (row) =>
          fomUsers.find((u) => u.id === (row as any).fom_assigned)
            ?.display_name || "",
      },
      {
        key: "warehouse_comment",
        label: "Warehouse Comment",
        longText: true,
        render: (row) =>
          editingId === String(row.id) ? (
            <Input
              className="h-8 text-xs cursor-pointer"
              value={(editForm as any)?.warehouse_comment || "—"}
              readOnly
              onClick={() =>
                openCommentModal(
                  String(row.id),
                  (editForm as any)?.warehouse_comment || "",
                )
              }
            />
          ) : (
            <span className="text-xs truncate block max-w-30">
              {(row as any).warehouse_comment || "—"}
            </span>
          ),
        getSearchableText: (row) => (row as any).warehouse_comment || "",
      },
      {
        key: "extracted_by",
        label: "Entered By",
        render: (row) =>
          ccUsers.find((u) => u.id === (row.extracted_by as any))
            ?.display_name || "—",
        getSearchableText: (row) =>
          ccUsers.find((u) => u.id === (row.extracted_by as any))
            ?.display_name || "",
      },
    ],
    [editingId, editForm, fomUsers, ccUsers, openCommentModal],
  );

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchOrders,
    [fetchOrders],
    realtimePaused,
  );

  const handleSave = useCallback(async () => {
    if (!editForm || !supabase) return;

    const assignedFom = (editForm as any).fom_assigned;
    const warehouseStatus = (editForm as any).warehouse_status;
    const validFomId = fomUsers.find((u) => u.id === assignedFom)?.id || null;

    if (warehouseStatus !== "out-of-stock") {
      if (!warehouseStatus) {
        toast.error("Please select a product warehouse status before saving.");
        return;
      }
      if (!validFomId) {
        toast.error("Please assign an FOM before saving.");
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase!
        .from("orders")
        .update(
          warehouseStatus === "out-of-stock"
            ? {
              status: "warehouse",
              inventory_status: editForm.inventory_status?.toLowerCase(),
              warehouse_status: warehouseStatus.toLowerCase(),
              warehouse_comment: (editForm as any).warehouse_comment,
              updated_at: new Date().toISOString(),
            }
            : {
              status: "warehouse",
              inventory_status: editForm.inventory_status?.toLowerCase(),
              warehouse_status: warehouseStatus.toLowerCase(),
              warehouse_comment: (editForm as any).warehouse_comment,
              fom_assigned: validFomId,
              fom_assigned_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              prints: (editForm.prints || 0) + 1,
            },
        )
        .eq("id", editForm.id);

      if (updateError) {
        throw updateError;
      }
      const updatedOrder = { ...editForm };
      setEditingId(null);
      setEditForm(null);
      warehouseStatus !== "out-of-stock" && printTicket(updatedOrder as Order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
      console.error(err as any);
    } finally {
      setIsSaving(false);
    }
  }, [editForm, fomUsers]);

  // Status filtering is already done server-side in the Supabase query.
  const actionableOrders = orders;

  const canSaveWarehouseUpdate = useMemo(() => {
    if (!editForm) return false;
    const warehouseStatus = (editForm as any).warehouse_status;
    const assignedFom = (editForm as any).fom_assigned;
    return Boolean(
      (warehouseStatus && assignedFom) || warehouseStatus === "out-of-stock",
    );
  }, [editForm]);

  const filteredActionableOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    // Merchant filtering is done server-side; only search term filtering remains client-side.
    return actionableOrders.filter((order) => {
      if (!term) return true;
      return (
        (order.customer_name || "").toLowerCase().includes(term) ||
        (order.delivery_address || "").toLowerCase().includes(term) ||
        (order.merchant || "").toLowerCase().includes(term) ||
        (order.id || "").toLowerCase().includes(term) ||
        (order.phone_numbers || []).join(" ").toLowerCase().includes(term)
      );
    });
  }, [actionableOrders, searchTerm]);

  const renderRowActions = useCallback(
    (row: any) => {
      const orderId = String(row.id);
      const isEditing = editingId === orderId;
      return (
        <div className="flex justify-end gap-1">
          {isEditing ? (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleSave}
                disabled={isSaving || !canSaveWarehouseUpdate}
                title={
                  canSaveWarehouseUpdate
                    ? "Save"
                    : "Select both inventory status and FOM assignment before saving"
                }
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
                onClick={() => {
                  setEditingId(null);
                  setEditForm(null);
                }}
                disabled={isSaving}
                title="Cancel"
              >
                <X className="h-4 w-4 text-destructive" />
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
    [editingId, handleSave, isSaving, canSaveWarehouseUpdate, startEditing],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Orders for Processing
        </h1>
        <p className="text-muted-foreground mt-2">
          Pick, pack, and advance orders through the warehouse workflow.
        </p>
      </div>

      <Card className="p-6">
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

      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Warehouse action queue
            </h2>
            <p className="text-sm text-muted-foreground">
              Pending orders are staged here until they are ready for
              fulfillment.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/50 px-4 py-2 text-sm text-foreground">
            {filteredActionableOrders.length}{" "}
            {filteredActionableOrders.length === 1 ? "order" : "orders"} in the
            queue{totalCount !== null && totalCount > filteredActionableOrders.length ? ` (${totalCount} total in DB)` : ""}
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
          <div>
            <DataTable
              headers={columns}
              rows={filteredActionableOrders as any}
              merchantOptions={merchantOptions}
              filterMerchant={filterMerchant}
              onFilterMerchantChange={setFilterMerchant}
              showActions
              renderRowActions={renderRowActions}
              onUserActivityChange={setRealtimePaused}
              onLoadMore={async () => {
                const nextPage = page + 1;
                setLoadingMore(true);
                const from = nextPage * PAGE_SIZE;
                const to = from + PAGE_SIZE - 1;
                let q = supabase!.from("orders").select("id, created_at, customer_name, delivery_address, phone_numbers, merchant, items, total_amount, warehouse_status, inventory_status, fom_assigned, warehouse_comment, extracted_by, status, prints")
                  .or("status.eq.customer_service,fom_assigned.is.null")
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
          </div>
        )}
      </Card>

      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="sm:max-w-131.25">
          <DialogHeader>
            <DialogDescription className="text-sm text-muted-foreground hidden">
              Edit the warehouse comment for this order.
            </DialogDescription>
            <DialogTitle>Edit Warehouse Comment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Enter detailed warehouse comment..."
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
