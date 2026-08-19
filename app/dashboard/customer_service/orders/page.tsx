"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Order } from "@/lib/types";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Package,
  Search,
  Edit2,
  Check,
  X,
  Download,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn, handleExport } from "@/lib/utils";
import { ExportButton } from "@/components/export-button";

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Order | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [ccUsers, setCcUsers] = useState<any[]>([]);
  const [fomUsers, setFomUsers] = useState<any[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  // Pause realtime while the user is editing a row, searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const PAGE_SIZE = 100;
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [modalField, setModalField] = useState<
    | "customer_name"
    | "delivery_address"
    | "phone_numbers"
    | "merchant"
    | "cc_comment"
    | "item_name"
    | null
  >(null);
  const [modalValue, setModalValue] = useState("");
  const [modalItemIndex, setModalItemIndex] = useState<number | null>(null);

  const isInitialLoad = useRef(true);

  const fetchOrders = useCallback(async (payload?: any) => {
    if (payload && payload.eventType) {
      const matchFilters = (order: Order) => {
        const matchesMerchant = !filterMerchant || order.merchant === filterMerchant;
        const createdAt = new Date(order.created_at);
        const matchesStart = !startDate || createdAt >= new Date(`${startDate}T00:00:00Z`);
        const matchesEnd = !endDate || createdAt <= new Date(`${endDate}T23:59:59Z`);
        return matchesMerchant && matchesStart && matchesEnd;
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
      // Load CC users
      const { data: ccUserData } = await supabase!
        .from("users")
        .select("id, display_name")
        .eq("role", "customer_service");
      if (ccUserData) setCcUsers(ccUserData);

      let ordersQuery = supabase!
        .from("orders")
        .select("id, created_at, customer_name, delivery_address, phone_numbers, merchant, items, total_amount, cc_comment, fom_delivery_status, extracted_by, status", { count: "exact" });

      if (startDate) {
        ordersQuery = ordersQuery.gte("created_at", `${startDate}T00:00:00Z`);
      }
      if (endDate) {
        ordersQuery = ordersQuery.lte("created_at", `${endDate}T23:59:59Z`);
      }

      const [
        { data: merchantData },
        { data, count, error: fetchError },
        { data: fomUserData },
      ] = await Promise.all([
        supabase!
          .from("merchants")
          .select("name")
          .eq("is_active", true)
          .order("name"),
        (() => {
          let q = ordersQuery.order("created_at", { ascending: false });
          if (filterMerchant) q = q.eq("merchant", filterMerchant);
          return q.order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1);
        })(),
        supabase!.from("users").select("id, display_name").eq("role", "fom"),
      ]);

      if (merchantData) {
        setMerchantOptions(
          merchantData.map((row: any) => row.name).filter(Boolean),
        );
      }

      if (fetchError) {
        throw fetchError;
      }

      setOrders((data ?? []) as Order[]);
      setTotalCount(count ?? 0);
      if (fomUserData) setFomUsers(fomUserData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterMerchant]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchOrders,
    [fetchOrders],
    realtimePaused,
  );

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    // Merchant filtering is done server-side
    return orders.filter((order) => {
      if (!term) return true;
      return (
        (order.customer_name || "").toLowerCase().includes(term) ||
        (order.delivery_address || "").toLowerCase().includes(term) ||
        (order.merchant || "").toLowerCase().includes(term) ||
        (order.id || "").toLowerCase().includes(term) ||
        (order.phone_numbers || []).join(" ").toLowerCase().includes(term)
      );
    });
  }, [orders, searchTerm]);

  const startEditing = useCallback((order: Order) => {
    setEditingId(order.id);
    setEditForm({ ...order });
  }, []);

  const openModal = useCallback(
    (
      field: typeof modalField & string,
      value: string,
      index: number | null = null,
    ) => {
      setModalField(field as any);
      setModalValue(value);
      setModalItemIndex(index);
      setModalOpen(true);
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
        label: "Date & Time",
        render: (row) => {
          const createdAt = row.created_at as string;
          if (!createdAt) return "—";
          return new Date(createdAt).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          });
        },
        getSearchableText: (row) => {
          const createdAt = row.created_at as string;
          if (!createdAt) return "";
          return new Date(createdAt).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          });
        },
      },
      {
        key: "customer_name",
        label: "Customer Name",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return isEditing ? (
            <Input
              value={editForm?.customer_name || ""}
              readOnly
              className="h-8 text-sm cursor-pointer"
              onClick={() =>
                openModal("customer_name", editForm?.customer_name || "")
              }
            />
          ) : (
            (row.customer_name as any) || "—"
          );
        },
        getSearchableText: (row) => `${row.customer_name as any}`,
      },
      {
        key: "delivery_address",
        label: "Delivery Address",
        longText: true,
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return isEditing ? (
            <Input
              value={editForm?.delivery_address || ""}
              readOnly
              className="h-8 text-sm cursor-pointer"
              onClick={() =>
                openModal("delivery_address", editForm?.delivery_address || "")
              }
            />
          ) : (
            (row.delivery_address as any) || "—"
          );
        },
        getSearchableText: (row) => `${row.delivery_address as any}`,
      },
      {
        key: "phone_numbers",
        label: "Phone",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          const phoneValue = (editForm?.phone_numbers || []).join(", ") || "";
          return isEditing ? (
            <Input
              value={phoneValue}
              readOnly
              className="h-8 text-sm cursor-pointer"
              onClick={() => openModal("phone_numbers", phoneValue)}
            />
          ) : (
            ((row.phone_numbers as string[]) || []).join(", ") || "—"
          );
        },
        getSearchableText: (row) =>
          `${((row.phone_numbers as string[]) || []).join(", ")}`,
      },
      {
        key: "item_name",
        label: "Product Name",
        longText: true,
        render: (row) => {
          const isEditing = editingId === String(row.id);
          const items = editForm?.items || (row.items as any[]) || [];
          return isEditing ? (
            <div className="flex flex-col gap-1">
              {items.map((item: any, idx: number) => (
                <Input
                  key={idx}
                  value={item.name}
                  readOnly
                  className="h-8 text-sm min-w-37.5 cursor-pointer"
                  onClick={() => openModal("item_name", item.name, idx)}
                />
              ))}
            </div>
          ) : (
            ((row.items as any[]) || [])
              .map((item: any) => item.name)
              .join(", ") || "—"
          );
        },
        getSearchableText: (row) =>
          `${((row.items as any[]) || [])
            .map((item: any) => item.name)
            .join(", ")}`,
      },
      {
        key: "item_quantity",
        label: "Qty",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          const items = editForm?.items || (row.items as any[]) || [];
          return isEditing ? (
            <div className="flex flex-col gap-1">
              {items.map((item: any, idx: number) => (
                <Input
                  key={idx}
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    setEditForm((prev) => {
                      if (!prev) return null;
                      const newItems = [...(prev.items || [])];
                      newItems[idx] = {
                        ...newItems[idx],
                        quantity: Number(e.target.value) || 0,
                      };
                      return { ...prev, items: newItems };
                    })
                  }
                  className="h-8 text-sm w-20"
                />
              ))}
            </div>
          ) : (
            ((row.items as any[]) || []).reduce(
              (total: number, item: any) => total + item.quantity,
              0,
            ) || "—"
          );
        },
        getSearchableText: (row) =>
          `${((row.items as any[]) || []).reduce(
            (total: number, item: any) => total + item.quantity,
            0,
          )}`,
      },
      {
        key: "total_amount",
        label: "Amount (₦)",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return isEditing ? (
            <Input
              type="number"
              value={editForm?.total_amount || 0}
              onChange={(e) =>
                setEditForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        total_amount: Number(e.target.value),
                      }
                    : null,
                )
              }
              className="h-8 text-sm w-24"
            />
          ) : (
            `₦${Number((row.total_amount as any) || 0).toLocaleString()}`
          );
        },
        getSearchableText: (row) =>
          `₦${Number((row.total_amount as any) || 0).toLocaleString()}`,
      },
      {
        key: "merchant",
        label: "Merchant Name",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return isEditing ? (
            <Input
              value={editForm?.merchant || ""}
              readOnly
              className="h-8 text-sm cursor-pointer"
              onClick={() => openModal("merchant", editForm?.merchant || "")}
            />
          ) : (
            (row.merchant as any) || "—"
          );
        },
        getSearchableText: (row) => `${row.merchant as any}`,
      },
      {
        key: "cc_comment",
        label: "Comments",
        longText: true,
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return isEditing ? (
            <Input
              value={editForm?.cc_comment || ""}
              readOnly
              className="h-8 text-sm cursor-pointer"
              onClick={() =>
                openModal("cc_comment", editForm?.cc_comment || "")
              }
            />
          ) : (
            (row.cc_comment as any) || "—"
          );
        },
        getSearchableText: (row) => `${row.cc_comment as any}`,
      },
      {
        key: "fom_delivery_status",
        label: "Delivery Status",
        render: (row) => {
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
        key: "extracted_by",
        label: "Entered By",
        render: (row) =>
          ccUsers.find((u) => u.id === (row.extracted_by as any))
            ?.display_name || "—", // Display
        getSearchableText: (row) =>
          ccUsers.find((u) => u.id === (row.extracted_by as any))
            ?.display_name || "", // Searchable text
      },
    ],
    [ccUsers, editingId, editForm, openModal, STATUS_LABELS, STATUS_STYLES],
  );

  const handleSave = async () => {
    if (!editForm || !supabase) return;

    setIsSaving(true);
    setError(null);

    if (editForm.status !== "customer_service") {
      toast.error(
        "Order cannot be updated as it's no longer in 'Customer Service' status.",
      );
      setIsSaving(false);
      return;
    }
    try {
      const { error: updateError } = await supabase!
        .from("orders")
        .update({
          customer_name: editForm.customer_name,
          delivery_address: editForm.delivery_address,
          phone_numbers: editForm.phone_numbers,
          merchant: editForm.merchant,
          total_amount: editForm.total_amount,
          items: editForm.items,
          cc_comment: editForm.cc_comment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editForm.id);

      if (updateError) throw updateError;

      setEditingId(null);
      setEditForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveModalValue = () => {
    if (!modalField || !editForm) return;

    setEditForm((prev) => {
      if (!prev) return null;

      if (modalField === "phone_numbers") {
        return {
          ...prev,
          phone_numbers: modalValue
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        };
      }

      if (modalField === "item_name" && modalItemIndex !== null) {
        const newItems = [...(prev.items || [])];
        newItems[modalItemIndex] = {
          ...newItems[modalItemIndex],
          name: modalValue,
        };
        return { ...prev, items: newItems };
      }

      return { ...prev, [modalField]: modalValue };
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground mt-2">
            Review customer orders and track their workflow across the system.
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

      {loading ? (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading orders...
          </p>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-destructive/10 border-destructive/30">
          <p className="text-destructive font-medium">Error loading orders</p>
          <p className="text-sm text-destructive/80 mt-2">{error}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-5">
          <DataTable
            headers={columns}
            rows={filteredOrders as any}
            showActions
            renderRowActions={(row) => {
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
                        onClick={() => setEditingId(null)}
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
            }}
            onUserActivityChange={setRealtimePaused}
            onLoadMore={async () => {
              const nextPage = page + 1;
              setLoadingMore(true);
              const from = nextPage * PAGE_SIZE;
              const to = from + PAGE_SIZE - 1;
              let q = supabase!.from("orders")
                .select("id, created_at, customer_name, delivery_address, phone_numbers, merchant, items, total_amount, cc_comment, fom_delivery_status, extracted_by, status")
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-131.25">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Edit {modalField?.replace("_", " ")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {modalField === "merchant" ? (
              <select
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={modalValue}
                onChange={(e) => setModalValue(e.target.value)}
              >
                <option value="">Select Merchant</option>
                {merchantOptions.map((merchant) => (
                  <option key={merchant} value={merchant}>
                    {merchant}
                  </option>
                ))}
              </select>
            ) : (
              <Textarea
                placeholder={`Enter ${modalField?.replace("_", " ")}...`}
                className="min-h-37.5"
                value={modalValue}
                onChange={(e) => setModalValue(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveModalValue}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
