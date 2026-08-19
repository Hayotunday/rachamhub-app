"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

const createSelectionId = () => Math.random().toString(36).slice(2);

type Merchant = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  merchant_id: string;
};

type Selection = {
  id: string;
  merchantId: string;
  productId: string;
};

type BreakdownOrder = {
  id: string;
  customer_name: string;
  merchant: string | null;
  items: Array<{ name: string; quantity: number }>;
  total_amount: number;
  payment_to_rider?: number | null;
  fom_delivery_status?: string | null;
  inventory_status?: string | null;
  created_at: string;
};

export default function ProductBreakdownPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<BreakdownOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownDate, setBreakdownDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [selections, setSelections] = useState<Selection[]>([
    { id: createSelectionId(), merchantId: "", productId: "" },
  ]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: merchantData }, { data: productData }] =
        await Promise.all([
          supabase!
            .from("merchants")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
          supabase!
            .from("products")
            .select("id, name, merchant_id")
            .eq("approval_status", "approved")
            .order("name"),
        ]);

      setMerchants((merchantData ?? []) as Merchant[]);
      setProducts((productData ?? []) as Product[]);
    } catch {
      toast.error("Failed to load merchants and products.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    const start = new Date(`${breakdownDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    try {
      const { data, error } = await supabase!
        .from("orders")
        .select("id, merchant, items, total_amount, payment_to_rider, fom_delivery_status, inventory_status, created_at, customer_name")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data ?? []) as BreakdownOrder[]);
    } catch {
      toast.error("Failed to load orders for the selected date.");
    }
  }, [breakdownDate]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateSelection = (
    id: string,
    field: "merchantId" | "productId",
    value: string,
  ) => {
    setSelections((prev) =>
      prev.map((selection) =>
        selection.id === id
          ? {
            ...selection,
            [field]: value,
            ...(field === "merchantId" ? { productId: "" } : null),
          }
          : selection,
      ),
    );
  };

  const addSelection = () => {
    setSelections((prev) => [
      ...prev,
      { id: createSelectionId(), merchantId: "", productId: "" },
    ]);
  };

  const removeSelection = (id: string) => {
    setSelections((prev) =>
      prev.length === 1
        ? [{ id: createSelectionId(), merchantId: "", productId: "" }]
        : prev.filter((selection) => selection.id !== id),
    );
  };

  const breakdowns = useMemo(() => {
    return selections
      .map((selection) => {
        const merchant = merchants.find((item) => item.id === selection.merchantId);
        const product = products.find((item) => item.id === selection.productId);
        if (!merchant || !product) return null;

        const matchingOrders = orders
          .map((order) => {
            if (order.merchant !== merchant.name) return null;
            const matchingItems = (order.items ?? []).filter(
              (item) =>
                item.name.trim().toLowerCase() ===
                product.name.trim().toLowerCase(),
            );
            if (matchingItems.length === 0) return null;
            return { ...order, items: matchingItems };
          })
          .filter(Boolean) as BreakdownOrder[];

        const quantity = matchingOrders.reduce(
          (sum, order) =>
            sum +
            order.items.reduce(
              (itemSum, item) => itemSum + Number(item.quantity || 0),
              0,
            ),
          0,
        );
        const orderValue = matchingOrders.reduce(
          (sum, order) => sum + Number(order.total_amount || 0),
          0,
        );
        const deliveryFees = matchingOrders.reduce(
          (sum, order) => sum + Number(order.payment_to_rider || 0),
          0,
        );

        return {
          id: selection.id,
          merchant,
          product,
          orders: matchingOrders,
          quantity,
          orderValue,
          deliveryFees,
        };
      })
      .filter(Boolean);
  }, [merchants, orders, products, selections]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Product Breakdown</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Select each merchant and product pair, then generate separate daily
          breakdowns.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="breakdown-date">Breakdown Date</Label>
            <Input
              id="breakdown-date"
              type="date"
              value={breakdownDate}
              onChange={(event) => setBreakdownDate(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            {selections.map((selection) => {
              const availableProducts = products.filter(
                (product) => product.merchant_id === selection.merchantId,
              );

              return (
                <div
                  key={selection.id}
                  className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selection.merchantId}
                    onChange={(event) =>
                      updateSelection(
                        selection.id,
                        "merchantId",
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Select merchant</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selection.productId}
                    disabled={!selection.merchantId}
                    onChange={(event) =>
                      updateSelection(
                        selection.id,
                        "productId",
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Select product</option>
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeSelection(selection.id)}
                    aria-label="Remove product selection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="outline" onClick={addSelection}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading breakdown data...
          </p>
        </Card>
      ) : breakdowns.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Select at least one merchant and product to generate a breakdown.
        </Card>
      ) : (
        breakdowns.map((breakdown: any) => (
          <Card key={breakdown.id} className="p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {breakdown.merchant.name} · {breakdown.product.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {new Date(`${breakdownDate}T00:00:00`).toLocaleDateString()}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-right text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Qty</p>
                  <p className="font-bold">{breakdown.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="font-bold">{breakdown.orders.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="font-bold">
                    {formatCurrency(breakdown.orderValue)}
                  </p>
                </div>
              </div>
            </div>

            {breakdown.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No matching orders for this product on the selected date.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                        Customer
                      </th>
                      <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                        Quantity
                      </th>
                      <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                        Status
                      </th>
                      <th className="p-3 text-right text-xs font-semibold text-muted-foreground">
                        Order Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.orders.map((order: BreakdownOrder) => (
                      <tr key={order.id} className="border-t border-border">
                        <td className="p-3 font-medium">{order.customer_name}</td>
                        <td className="p-3">
                          {order.items.reduce(
                            (sum, item) => sum + Number(item.quantity || 0),
                            0,
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {order.fom_delivery_status ||
                            order.inventory_status ||
                            "pending"}
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {formatCurrency(order.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
