"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { useGlobalStats } from "@/hooks/use-global-stats";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Download, Trash2, Edit2, Check, X } from "lucide-react";
import { Order } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  buildCsv,
  cn,
  formatCurrency,
  formatDateDisplay,
  handleExport,
} from "@/lib/utils";
import { ExportButton } from "@/components/export-button";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Order | null>(null);
  const [fomUsers, setFomUsers] = useState<any[]>([]);
  const [ccUsers, setCcUsers] = useState<any[]>([]);

  // We only fetch global stats once per component mount (or when updated)
  const { stats, refreshStats } = useGlobalStats();

  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [riderOptions, setRiderOptions] = useState<string[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [filterMerchant, setFilterMerchant] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // Pause realtime while the user is editing a row, searching or filtering
  const [realtimePaused, setRealtimePaused] = useState(false);
  const [dataLimit, setDataLimit] = useState(100);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Modal states for long text fields
  const [modalOpen, setModalOpen] = useState(false);
  const [modalField, setModalField] = useState<string | null>(null);
  const [modalValue, setModalValue] = useState("");
  const [modalOrderId, setModalOrderId] = useState<string | null>(null);
  const [modalItemIndex, setModalItemIndex] = useState<number | null>(null);

  const isInitialLoad = useRef(true);

  const fetchOrders = useCallback(
    async (payload?: any) => {
      if (payload && payload.eventType) {
        const matchFilters = (order: Order) => {
          const matchesMerchant = !filterMerchant || order.merchant === filterMerchant;
          const createdAt = new Date(order.created_at);
          const matchesStart =
            !startDate || createdAt >= new Date(`${startDate}T00:00:00Z`);
          const matchesEnd =
            !endDate || createdAt <= new Date(`${endDate}T23:59:59Z`);
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
              prev.map((o) => (o.id === payload.new.id ? payload.new : o)),
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

      const [
        { data: merchantData },
        { data: riderData },
        { data: fomUserData },
        { data: ccUserData },
        { data: landmarkData },
      ] = await Promise.all([
        supabase!
          .from("merchants")
          .select("name")
          .eq("is_active", true)
          .order("name"),
        supabase!
          .from("riders")
          .select("name")
          .eq("is_active", true)
          .order("name"),
        supabase!.from("users").select("id, display_name").eq("role", "fom"),
        supabase!
          .from("users")
          .select("id, display_name")
          .eq("role", "customer_service"),
        supabase!.from("landmarks").select("*"),
      ]);

      if (fomUserData) setFomUsers(fomUserData);
      if (ccUserData) setCcUsers(ccUserData);
      if (landmarkData) setLandmarks(landmarkData);

      if (merchantData) {
        setMerchantOptions(
          merchantData.map((row: any) => row.name).filter(Boolean),
        );
      }
      if (riderData) {
        setRiderOptions(riderData.map((row: any) => row.name).filter(Boolean));
      }

      try {
        let query = supabase!
          .from("orders")
          .select("id, created_at, customer_name, delivery_address, phone_numbers, merchant, items, total_amount, payment_to_rider, warehouse_status, inventory_status, fom_delivery_status, fom_assigned, rider_name, rider_assigned_at, payment_method, payment_confirmed, payment_verified_at, bank, landmark, warehouse_comment, cc_comment, fom_comment, updated_at", { count: "exact" });
        if (filterMerchant) {
          query = query.eq("merchant", filterMerchant);
        }
        query = query
          .order("created_at", { ascending: false })
          .limit(dataLimit);
        if (startDate) {
          query = query.gte("created_at", `${startDate}T00:00:00Z`);
        }
        if (endDate) {
          query = query.lte("created_at", `${endDate}T23:59:59Z`);
        }

        const { data, count, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        setOrders((data ?? []) as Order[]);
        setTotalCount(count ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load orders.");
      } finally {
        setLoading(false);
      }
    },
    [endDate, startDate, dataLimit, filterMerchant],
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useSupabaseRealtime(
    [{ table: "orders", event: "*" }],
    fetchOrders,
    [fetchOrders],
    realtimePaused,
  );

  const startEditing = useCallback((order: Order) => {
    setEditingId(order.id);
    setEditForm({ ...order });
    setEditedFields(new Set());
  }, []);

  const openModal = (
    field: string,
    value: string,
    orderId: string,
    index: number | null = null,
  ) => {
    setModalField(field);
    setModalValue(value);
    setModalOrderId(orderId);
    setModalItemIndex(index);
    setModalOpen(true);
  };

  const handleSaveModalValue = () => {
    if (modalField && editForm && modalOrderId && modalOrderId === editingId) {
      const newEditedFields = new Set(editedFields);
      newEditedFields.add(modalField);
      setEditedFields(newEditedFields);

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
    }
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (!editForm) return;
    setActionLoading(editForm.id);

    try {
      const { error: updateError } = await supabase!
        .from("orders")
        .update({
          customer_name: editForm.customer_name,
          delivery_address: editForm.delivery_address,
          phone_numbers: editForm.phone_numbers,
          merchant: editForm.merchant,
          items: editForm.items,
          total_amount: editForm.total_amount,
          inventory_status: editForm.inventory_status?.toLowerCase(),
          fom_delivery_status: editForm.fom_delivery_status?.toLowerCase(),
          warehouse_status: (editForm as any).warehouse_status?.toLowerCase(),
          fom_assigned: (editForm as any).fom_assigned,
          warehouse_comment: (editForm as any).warehouse_comment,
          rider_name: (editForm as any).rider_name,
          payment_to_rider: (editForm as any).payment_to_rider,
          payment_method: (editForm as any).payment_method?.toLowerCase(),
          payment_confirmed:
            (editForm as any).payment_confirmed === "true" ||
            (editForm as any).payment_confirmed === true,
          bank: (editForm as any).bank,
          cc_comment: (editForm as any).cc_comment,
          fom_comment: (editForm as any).fom_comment,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editForm.id);

      if (updateError) throw updateError;
      toast.success("Order updated successfully");
      setEditingId(null);
      setEditForm(null);
      fetchOrders();
      refreshStats();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update order",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    const confirmed = window.confirm(
      "Delete this order permanently? This action cannot be undone.",
    );
    if (!confirmed) return;

    setActionLoading(id);
    setError(null);

    try {
      const { error: deleteError } = await supabase!
        .from("orders")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      await fetchOrders();
      refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete order.");
    } finally {
      setActionLoading(null);
    }
  };

  const columns = useMemo<DataTableColumn[]>(
    () => [
      {
        key: "id_date",
        label: "Order Info",
        render: (row) => (
          <div className="py-1">
            <div className="font-mono text-[10px] uppercase">
              #{String((row as any).id).split("-")[0]}
            </div>
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
              {new Date((row as any).created_at as any).toLocaleString([], {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </div>
          </div>
        ),
        getSearchableText: (row) =>
          `${String((row as any).id).split("-")[0]} ${new Date(
            (row as any).created_at as any,
          ).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          })}`,
      },
      {
        key: "customer_name",
        label: "Customer",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return (
            <div className="py-1 space-y-1">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <Input
                    className="h-7 text-xs"
                    value={editForm?.customer_name || ""}
                    onChange={(e) => {
                      const newEditedFields = new Set(editedFields);
                      newEditedFields.add("customer_name");
                      setEditedFields(newEditedFields);
                      setEditForm((prev) =>
                        prev
                          ? { ...prev, customer_name: e.target.value }
                          : null,
                      );
                    }}
                  />
                  {editedFields.has("customer_name") && (
                    <span className="text-[8px] px-1 py-0.5 rounded-full bg-gray-400 text-gray-700 whitespace-nowrap">
                      edited
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs font-semibold">
                  {(row as any).customer_name as any}
                </div>
              )}
              <div
                className="text-[10px] text-muted-foreground truncate cursor-pointer underline decoration-dotted"
                onClick={() =>
                  openModal(
                    "delivery_address",
                    isEditing
                      ? editForm?.delivery_address || ""
                      : (row as any).delivery_address || "",
                    String((row as any).id),
                  )
                }
              >
                {(row as any).delivery_address || "No Address"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {(((row as any).phone_numbers as string[]) || []).join(", ")}
              </div>
            </div>
          );
        },
        getSearchableText: (row) =>
          `${(row as any).customer_name as any} ${(row as any).delivery_address} ${(((row as any).phone_numbers as string[]) || []).join(", ")}`,
      },
      {
        key: "merchant",
        label: "Merchant / Items",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return (
            <div className="py-1 space-y-1">
              {isEditing ? (
                <select
                  className="h-7 w-full rounded-md border border-input bg-background px-1 text-xs"
                  value={editForm?.merchant || ""}
                  onChange={(e) => {
                    const newEditedFields = new Set(editedFields);
                    newEditedFields.add("merchant");
                    setEditedFields(newEditedFields);
                    setEditForm((prev) =>
                      prev ? { ...prev, merchant: e.target.value } : null,
                    );
                  }}
                >
                  <option value="">Select Merchant</option>
                  {merchantOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-medium">
                  {(row as any).merchant as any}
                </div>
              )}
              <div className="text-[10px] truncate italic">
                {(((row as any).items as any[]) || [])
                  .map((i) => `${i.quantity}x ${i.name}`)
                  .join(", ")}
              </div>
            </div>
          );
        },
        getSearchableText: (row) =>
          `${(row as any).merchant as any} ${(
            ((row as any).items as any[]) || []
          )
            .map((i) => `${i.quantity}x ${i.name}`)
            .join(", ")}`,
      },
      {
        key: "financials",
        label: "Amount (₦)",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          const total = Number(
            (isEditing ? editForm?.total_amount : row.total_amount) || 0,
          );
          const landmarkfee = Number(
            landmarks!.find((l) => l.name === row.landmark)?.price || 0,
          );
          const toMerchant = total - landmarkfee;
          return (
            <div className="py-1 space-y-0.5">
              {isEditing ? (
                <Input
                  type="number"
                  className="h-7 text-xs w-full"
                  value={editForm?.total_amount || 0}
                  onChange={(e) => {
                    const newEditedFields = new Set(editedFields);
                    newEditedFields.add("total_amount");
                    setEditedFields(newEditedFields);
                    setEditForm((prev) =>
                      prev
                        ? { ...prev, total_amount: Number(e.target.value) }
                        : null,
                    );
                  }}
                />
              ) : (
                <div className="text-xs font-bold">{formatCurrency(total)}</div>
              )}
              <div className="text-[9px] text-muted-foreground">
                Landmark:{" "}
                {`${row.landmark || "—"} * ${formatCurrency(landmarkfee)}`}
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold">
                Merchant: {formatCurrency(toMerchant)}
              </div>
            </div>
          );
        },
        getSearchableText: (row) => {
          const total = Number(row.total_amount);
          const riderFee = Number((row as any).payment_to_rider);

          const toMerchant = total - riderFee;

          return `${formatCurrency(total)} ${formatCurrency(riderFee)} ${formatCurrency(toMerchant)}`;
        },
      },
      {
        key: "status_group",
        label: "Statuses",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return (
            <div className="py-1 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] uppercase text-muted-foreground font-bold">
                  WH:
                </span>
                {isEditing ? (
                  <select
                    className="h-6 text-[9px] rounded border px-1"
                    value={editForm?.warehouse_status || ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        warehouse_status: e.target.value,
                      }))
                    }
                  >
                    {["unpacked", "packed", "out-of-stock"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={cn(
                      "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm",
                      String(row.warehouse_status) === "packed"
                        ? "bg-emerald-100 text-emerald-700"
                        : String(row.warehouse_status) === "out-of-stock"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {String(row.warehouse_status || "unpacked")}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] uppercase text-muted-foreground font-bold">
                  INV:
                </span>
                {isEditing ? (
                  <select
                    className="h-6 text-[9px] rounded border px-1"
                    value={editForm?.inventory_status || ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        inventory_status: e.target.value as any,
                      }))
                    }
                  >
                    {[
                      "pending",
                      "delivered",
                      "returned",
                      "failed",
                      "canceled",
                      "shelved",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={cn(
                      "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm",
                      String(row.inventory_status) === "delivered"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {String(row.inventory_status || "pending")}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] uppercase text-muted-foreground font-bold">
                  FOM:
                </span>
                {isEditing ? (
                  <select
                    className="h-6 text-[9px] rounded border px-1"
                    value={editForm?.fom_delivery_status || ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        fom_delivery_status: e.target.value as any,
                      }))
                    }
                  >
                    {[
                      "pending",
                      "delivered",
                      "returned",
                      "failed",
                      "canceled",
                      "shelved",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={cn(
                      "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm",
                      String(row.fom_delivery_status) === "delivered"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {String(row.fom_delivery_status || "pending")}
                  </span>
                )}
              </div>
            </div>
          );
        },
        getSearchableText: (row) =>
          `${String(row.inventory_status)} ${String(row.fom_delivery_status)}`,
      },
      {
        key: "dispatch",
        label: "FOM / Rider",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          return (
            <div className="py-1 space-y-1 flex flex-col gap-1">
              {isEditing ? (
                <select
                  className="h-7 w-full rounded-md border px-1 text-[10px]"
                  value={(editForm as any)?.fom_assigned || ""}
                  onChange={(e) =>
                    setEditForm((p: any) => ({
                      ...p,
                      fom_assigned: e.target.value,
                    }))
                  }
                >
                  <option value="">Unassigned</option>
                  {fomUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[10px] font-medium">
                  Fom:{" "}
                  {fomUsers.find((u) => u.id === (row as any).fom_assigned)
                    ?.display_name || "—"}
                </div>
              )}
              {isEditing ? (
                <select
                  className="h-7 w-full rounded-md border px-1 text-[10px]"
                  value={(editForm as any)?.rider_name || ""}
                  onChange={(e) =>
                    setEditForm((p: any) => ({
                      ...p,
                      rider_name: e.target.value,
                    }))
                  }
                >
                  <option value="">Select Rider</option>
                  {riderOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-[10px] text-muted-foreground italic">
                  Rider: {(row as any).rider_name || "—"}
                </div>
              )}
              {(row as any).rider_assigned_at && (
                <div className="text-[8px] text-muted-foreground leading-none">
                  Rider Assg.:{" "}
                  {new Date((row as any).rider_assigned_at).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              )}
            </div>
          );
        },
        getSearchableText: (row) =>
          `${
            fomUsers.find((u) => u.id === (row as any).fom_assigned)
              ?.display_name
          } ${(row as any).rider_name} ${new Date(
            (row as any).rider_assigned_at,
          ).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`,
      },
      {
        key: "payment_info",
        label: "Payment",
        render: (row) => {
          const isEditing = editingId === String((row as any).id);
          return (
            <div className="py-1 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="font-bold">Method:</span>
                {isEditing ? (
                  <select
                    className="h-6 border px-1"
                    value={(editForm as any)?.payment_method || ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        payment_method: e.target.value,
                      }))
                    }
                  >
                    <option value="">N/A</option>
                    {["Cash", "Transfer", "PBD"].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{(row as any).payment_method || "—"}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Confirmed:</span>
                {isEditing ? (
                  <select
                    className="h-6 border px-1"
                    value={String((editForm as any)?.payment_confirmed)}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        payment_confirmed: e.target.value === "true",
                      }))
                    }
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                ) : (
                  <span
                    className={
                      row.payment_confirmed
                        ? "text-emerald-600 font-bold"
                        : "text-amber-600"
                    }
                  >
                    {row.payment_confirmed ? "Yes" : "No"}
                  </span>
                )}
              </div>
              {(row as any).payment_verified_at && (
                <div className="text-[8px] text-muted-foreground italic">
                  Verified:{" "}
                  {new Date((row as any).payment_verified_at).toLocaleString(
                    [],
                    { dateStyle: "short", timeStyle: "short" },
                  )}
                </div>
              )}
              <div className="flex justify-between items-center gap-1">
                <span className="font-bold">Bank:</span>
                {isEditing ? (
                  <select
                    className="h-5 text-[8px] rounded border px-1 bg-white max-w-20"
                    value={(editForm as any)?.bank || ""}
                    onChange={(e) =>
                      setEditForm((p: any) => ({
                        ...p,
                        bank: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select</option>
                    <option value="moniepoint">Moniepoint</option>
                    <option value="UBA">UBA</option>
                  </select>
                ) : (
                  <span className="truncate max-w-20 text-right">
                    {(row as any).bank || "—"}
                  </span>
                )}
              </div>
            </div>
          );
        },
        getSearchableText: (row) =>
          `${(row as any).payment_method} ${row.payment_confirmed ? "Yes" : "No"} ${new Date(
            (row as any).payment_verified_at,
          ).toLocaleString([], {
            dateStyle: "short",
            timeStyle: "short",
          })} ${(row as any).bank}`,
      },
      {
        key: "amount_paid",
        label: "Amount Paid",
        render: (row) => {
          const value = ((row as any).amount_paid as string) || "—";
          return (
            <span className="text-[9px] whitespace-normal wrap-break-word cursor-pointer py-1 leading-tight">
              {value}
            </span>
          );
        },
        getSearchableText: (row) => `${(row as any).amount_paid as string}`,
      },
      {
        key: "cc_comment",
        label: "CC Note",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          const value =
            ((isEditing
              ? editForm?.cc_comment
              : (row as any).cc_comment) as string) || "—";
          return (
            <div
              className="text-[9px] whitespace-normal wrap-break-word cursor-pointer py-1 leading-tight"
              onClick={() =>
                openModal(
                  "cc_comment",
                  value === "—" ? "" : value,
                  String(row.id),
                )
              }
            >
              {value}
            </div>
          );
        },
        getSearchableText: (row) => `${(row as any).cc_comment as string}`,
      },
      {
        key: "warehouse_comment",
        label: "WH Note",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          const value =
            ((isEditing
              ? editForm?.warehouse_comment
              : (row as any).warehouse_comment) as string) || "—";
          return (
            <div
              className="text-[9px] whitespace-normal wrap-break-word cursor-pointer py-1 leading-tight"
              onClick={() =>
                openModal(
                  "warehouse_comment",
                  value === "—" ? "" : value,
                  String(row.id),
                )
              }
            >
              {value}
            </div>
          );
        },
        getSearchableText: (row) =>
          `${(row as any).warehouse_comment as string}`,
      },
      {
        key: "fom_comment",
        label: "FOM Note",
        render: (row) => {
          const isEditing = editingId === String(row.id);
          const value =
            ((isEditing
              ? editForm?.fom_comment
              : (row as any).fom_comment) as string) || "—";
          return (
            <div
              className="text-[9px] whitespace-normal wrap-break-word cursor-pointer py-1 leading-tight"
              onClick={() =>
                openModal(
                  "fom_comment",
                  value === "—" ? "" : value,
                  String(row.id),
                )
              }
            >
              {value}
            </div>
          );
        },
        getSearchableText: (row) => `${(row as any).fom_comment as string}`,
      },
      {
        key: "extracted_by",
        label: "Entered By",
        render: (row) => (
          <div className="text-[10px] text-muted-foreground whitespace-nowrap">
            {ccUsers.find((u) => u.id === (row.extracted_by as any))
              ?.display_name || "—"}
          </div>
        ),
        getSearchableText: (row) =>
          `${
            ccUsers.find((u) => u.id === (row.extracted_by as any))
              ?.display_name
          }`,
      },
    ],
    [
      editingId,
      editForm,
      editedFields,
      merchantOptions,
      fomUsers,
      riderOptions,
      ccUsers,
    ],
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
                disabled={actionLoading === String(row.id)}
              >
                {actionLoading === String(row.id) ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 text-emerald-500" />
                )}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setEditingId(null)}
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => startEditing(row as unknown as Order)}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleDeleteOrder(String(row.id))}
                disabled={actionLoading === String(row.id)}
                title="Delete order"
              >
                {actionLoading === String(row.id) ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </>
          )}
        </div>
      );
    },
    [editingId, actionLoading, handleSave, startEditing, handleDeleteOrder],
  );

  const summary = useMemo(() => {
    return {
      total: stats.total_orders,
      delivered: stats.delivered_orders,
      failed: stats.failed_orders,
      revenue: stats.total_revenue,
      owed: stats.total_owed,
      fees: stats.total_fees,
      successRate:
        stats.total_orders === 0
          ? 0
          : Math.round((stats.delivered_orders / stats.total_orders) * 100),
    };
  }, [stats]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Orders</h1>
          <p className="text-muted-foreground mt-2">
            View every order across all departments and manage system-level
            records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            disabled={loading || orders.length === 0}
            onExport={async (start, end, type) =>
              await handleExport(fomUsers, ccUsers, type, start, end)
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total orders</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {summary.total}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Delivery success</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {summary.successRate}%
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Failed / canceled</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {summary.failed}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total revenue</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {formatCurrency(summary.revenue)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Fees collected</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {formatCurrency(summary.fees)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Amount Paid to merchants
          </p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {formatCurrency(summary.owed)}
          </p>
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
        <Card className="p-6 bg-destructive/10 text-destructive">{error}</Card>
      ) : (
        <Card className="p-6">
          <DataTable
            headers={columns}
            rows={orders as any}
            merchantOptions={merchantOptions}
            filterMerchant={filterMerchant}
            onFilterMerchantChange={setFilterMerchant}
            searchPlaceholder="Search system-wide orders..."
            showActions
            renderRowActions={renderRowActions}
            onUserActivityChange={setRealtimePaused}
            dataLimit={dataLimit}
            onDataLimitChange={setDataLimit}
            totalCount={totalCount ?? undefined}
          />
        </Card>
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setModalOrderId(null);
        }}
      >
        <DialogContent className="sm:max-w-125">
          <DialogDescription className="hidden">Input Dialog</DialogDescription>
          <DialogHeader>
            <DialogTitle className="capitalize">
              Edit {modalField?.replace(/_/g, " ")}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              className="min-h-37.5"
              value={modalValue}
              onChange={(e) => setModalValue(e.target.value)}
              readOnly={modalOrderId !== editingId}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            {editingId && modalOrderId === editingId && (
              <Button onClick={handleSaveModalValue}>Save Changes</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
