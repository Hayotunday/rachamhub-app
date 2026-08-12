"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Check, Edit2, Loader2, X } from "lucide-react";
import { Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn, handleExport, printTicket } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";
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
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-purple-100 text-purple-900",
  delivered: "bg-emerald-100 text-emerald-900",
  returned: "bg-orange-100 text-orange-900",
  failed: "bg-red-100 text-red-900",
  canceled: "bg-slate-100 text-slate-900",
  shelved: "bg-amber-100 text-amber-900",
};

export default function OutOfStockPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fomUsers, setFomUsers] = useState<any[]>([]);
  const [ccUsers, setCcUsers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Order | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activeCommentOrderId, setActiveCommentOrderId] = useState<
    string | null
  >(null);
  const [tempComment, setTempComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  // Pause realtime while the user is editing a row, searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [dataLimit, setDataLimit] = useState(100);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

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
        label: "Customer",
        longText: true,
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
        key: "items",
        label: "Items",
        longText: true,
        render: (row) =>
          ((row.items as any[]) || [])
            .map((item: any) => `${item.quantity}x ${item.name}`)
            .join(", "),
        getSearchableText: (row) =>
          ((row.items as any[]) || []).map((item: any) => item.name).join(", "),
      },
      {
        key: "merchant",
        label: "Merchant",
        render: (row) => (row.merchant as any) || "—",
        getSearchableText: (row) => (row.merchant as any) || "",
      },
      {
        key: "warehouse_status",
        label: "Warehouse Status",
        render: (row) =>
          editingId === String(row.id) ? (
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px]"
              value={(editForm as any)?.warehouse_status || "unpacked"}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev ? { ...prev, warehouse_status: e.target.value } : prev,
                )
              }
            >
              <option value="out-of-stock">Out of Stock</option>
              <option value="unpacked">Unpacked</option>
              <option value="packed">Packed</option>
            </select>
          ) : (
            (row as any).warehouse_status || "unpacked"
          ),
        getSearchableText: (row) => (row as any).warehouse_status || "unpacked",
      },
      {
        key: "fom_assigned",
        label: "FOM Assigned",
        render: (row) =>
          editingId === String(row.id) ? (
            <select
              value={(editForm as any)?.fom_assigned || ""}
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
              readOnly
              onClick={() =>
                openCommentModal(
                  String(row.id),
                  (editForm as any)?.warehouse_comment || "",
                )
              }
              value={(editForm as any)?.warehouse_comment || "—"}
            />
          ) : (
            (row as any).warehouse_comment || "—"
          ),
        getSearchableText: (row) => (row as any).warehouse_comment || "",
      },
    ],
    [editingId, editForm, fomUsers, openCommentModal],
  );

  const isInitialLoad = useRef(true);

  const fetchOrders = useCallback(async (payload?: any) => {
    if (payload && payload.eventType) {
      const matchFilters = (order: Order) => {
        const matchesStatus = order.warehouse_status === "out-of-stock";
        const matchesCS = order.status !== "customer_service";
        const createdAt = new Date(order.created_at);
        const matchesStart = !startDate || createdAt >= new Date(`${startDate}T00:00:00Z`);
        const matchesEnd = !endDate || createdAt <= new Date(`${endDate}T23:59:59Z`);
        return matchesStatus && matchesCS && matchesStart && matchesEnd;
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
        { data: fomUserData },
        { data: ccUserData },
      ] = await Promise.all([
        ordersQuery
          .eq("warehouse_status", "out-of-stock")
          .neq("status", "customer_service")
          .order("created_at", { ascending: false })
          .limit(dataLimit),
        supabase!
          .from("merchants")
          .select("name")
          .eq("is_active", true)
          .order("name"),
        supabase!.from("users").select("id, display_name").eq("role", "fom"),
        supabase!
          .from("users")
          .select("id, display_name")
          .eq("role", "customer_service"),
      ]);

      if (fetchError) throw fetchError;

      if (merchantsData)
        setMerchantOptions(merchantsData.map((m: any) => m.name));
      if (fomUserData) setFomUsers(fomUserData);
      if (ccUserData) setCcUsers(ccUserData);
      setOrders((ordersData ?? []) as Order[]);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load inventory.",
      );
    } finally {
      setLoading(false);
    }
  }, [dataLimit, startDate, endDate]);

  const handleSaveComment = () => {
    if (
      activeCommentOrderId &&
      editForm &&
      editForm.id === activeCommentOrderId
    ) {
      setEditForm((prev) =>
        prev ? { ...prev, warehouse_comment: tempComment } : null,
      );
    }
    setCommentModalOpen(false);
  };

  const handleSave = useCallback(async () => {
    if (!editForm) return;

    const assignedFom = (editForm as any).fom_assigned;
    const warehouseStatus =
      (editForm as any).warehouse_status === "out-of-stock";
    const validFomId = fomUsers.find((u) => u.id === assignedFom)?.id || null;

    setIsSaving(true);
    setError(null);

    // If warehouse_status is updated to packed or unpacked,
    if (warehouseStatus) {
      toast.error("Please select a product warehouse status before saving.");
      return;
    }
    if (!validFomId) {
      toast.error("Please assign an FOM before saving.");
      return;
    }

    try {
      const { error: updateError } = await supabase!
        .from("orders")
        .update({
          status: "warehouse",
          warehouse_status: editForm.warehouse_status?.toLowerCase(),
          warehouse_comment: editForm.warehouse_comment,
          fom_assigned: validFomId,
          fom_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", editForm.id);

      if (updateError) throw updateError;

      const updatedOrder = { ...editForm };
      setEditingId(null);
      setEditForm(null);
      printTicket(updatedOrder as Order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setIsSaving(false);
    }
  }, [editForm]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchOrders,
    [fetchOrders],
    realtimePaused,
  );

  const actionableOrders = useMemo(
    () => orders.filter((order) => order.status !== "customer_service"),
    [orders],
  );

  const filteredActionableOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return actionableOrders.filter((order) => {
      if (filterMerchant && order.merchant !== filterMerchant) return false;
      if (!term) return true;
      return (
        (order.customer_name || "").toLowerCase().includes(term) ||
        (order.delivery_address || "").toLowerCase().includes(term) ||
        (order.merchant || "").toLowerCase().includes(term) ||
        (order.id || "").toLowerCase().includes(term) ||
        (order.phone_numbers || []).join(" ").toLowerCase().includes(term)
      );
    });
  }, [actionableOrders, searchTerm, filterMerchant]);

  const renderRowActions = useCallback(
    (row: any) => {
      const orderId = String(row.id);
      const isEditing = editingId === orderId;
      const isSubmitDisabled =
        (editForm as any)?.warehouse_status !== "out-of-stock" &&
        (editForm as any)?.fom_assigned !== "";
      return (
        <div className="flex justify-end gap-1">
          {isEditing ? (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={handleSave}
                disabled={isSaving || !isSubmitDisabled}
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
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => startEditing(row as unknown as Order)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    },
    [editingId, handleSave, isSaving, startEditing],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Out of Stock Orders
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage orders that are currently out of stock. Update status when
            items become available.
          </p>{" "}
          <div className="flex flex-wrap gap-2 mt-4">
            <ExportButton
              disabled={loading || orders.length === 0}
              onExport={async (start, end, type) =>
                await handleExport(fomUsers, ccUsers, type, start, end)
              }
            />
          </div>
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Out of Stock Queue
          </h2>
          <div className="text-sm text-muted-foreground">
            {actionableOrders.length} orders shown
            {totalCount !== null ? ` · ${totalCount} total in DB` : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <DataTable
            headers={columns}
            rows={filteredActionableOrders as any}
            merchantOptions={merchantOptions}
            filterMerchant={filterMerchant}
            onFilterMerchantChange={setFilterMerchant}
            showActions
            renderRowActions={renderRowActions}
            onUserActivityChange={setRealtimePaused}
            dataLimit={dataLimit}
            onDataLimitChange={setDataLimit}
            totalCount={totalCount ?? undefined}
          />
        </div>
      </Card>

      <Dialog open={commentModalOpen} onOpenChange={setCommentModalOpen}>
        <DialogContent className="sm:max-w-131.25">
          <DialogHeader>
            <DialogDescription className="hidden">
              Edit Warehouse Comment
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
