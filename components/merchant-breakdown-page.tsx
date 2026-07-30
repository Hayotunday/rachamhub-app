"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { formatCurrency } from "@/lib/utils";

type Merchant = { id: string; name: string };

type BreakdownOrder = {
  id: string;
  customer_name: string;
  merchant: string | null;
  items: Array<{ name: string; quantity: number }>;
  amount_paid?: number | null;
  total_amount: number;
  payment_to_merchant?: number | null;
  payment_to_rider?: number | null;
  fom_delivery_status?: string | null;
  inventory_status?: string | null;
  rider_name?: string | null;
  landmark?: string | null;
  created_at: string;
  delivered_at?: string | null;
};

export default function MerchantBreakdownPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [orders, setOrders] = useState<BreakdownOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [breakdownDate, setBreakdownDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [selectedMerchantId, setSelectedMerchantId] = useState("");

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase!
        .from("merchants")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setMerchants((data ?? []) as Merchant[]);
    } catch {
      toast.error("Failed to load merchants.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!selectedMerchantId) {
      setOrders([]);
      return;
    }
    const merchant = merchants.find((m) => m.id === selectedMerchantId);
    if (!merchant) return;

    setOrdersLoading(true);
    try {
      const start = new Date(`${breakdownDate}T05:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data, error } = await supabase!
        .from("orders")
        .select("*")
        .eq("merchant", merchant.name)
        .gte("delivered_at", start.toISOString())
        .lt("delivered_at", end.toISOString())
        .order("delivered_at", { ascending: false });

      if (error) throw error;
      setOrders(data);
      setOrders((data ?? []) as BreakdownOrder[]);
    } catch {
      toast.error("Failed to load orders for the selected date.");
    } finally {
      setOrdersLoading(false);
    }
  }, [selectedMerchantId, breakdownDate, merchants]);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const selectedMerchant = merchants.find((m) => m.id === selectedMerchantId);

  // ── Word document download ──────────────────────────────────────────────────
  const handleDownloadWord = async () => {
    if (!selectedMerchant || orders.length === 0) return;
    setDownloading(true);

    try {
      // Fetch current stock counts for this merchant's products
      const { data: productData } = await supabase!
        .from("products")
        .select("id, name")
        .eq("merchant_id", selectedMerchantId)
        .eq("approval_status", "approved");

      const { data: addedEntries } = await supabase!
        .from("stock_entries")
        .select("product_id, quantity")
        .eq("status", "approved");

      const { data: deliveredOrders } = await supabase!
        .from("orders")
        .select("items")
        .eq("merchant", selectedMerchant.name)
        .eq("fom_delivery_status", "delivered");

      const { data: landmarksData } = await supabase!
        .from("landmarks")
        .select("name, price");
      const landmarksMap = new Map<string, number>();
      for (const l of landmarksData ?? []) {
        if (l.name) landmarksMap.set(l.name.toLowerCase(), l.price || 0);
      }

      // Build added map
      const addedMap: Record<string, number> = {};
      for (const e of addedEntries ?? []) {
        addedMap[e.product_id] = (addedMap[e.product_id] || 0) + e.quantity;
      }
      // Build deducted map
      const deductedMap: Record<string, number> = {};
      for (const o of deliveredOrders ?? []) {
        for (const item of (o.items as any[]) ?? []) {
          const product = (productData ?? []).find(
            (p) => p.name?.toLowerCase() === item.name?.toLowerCase(),
          );
          if (product) {
            deductedMap[product.id] =
              (deductedMap[product.id] || 0) + (item.quantity || 1);
          }
        }
      }

      const stockLines = (productData ?? []).map((p) => {
        const current = (addedMap[p.id] || 0) - (deductedMap[p.id] || 0);
        return `${current} ${p.name} left`;
      });

      // ── Build document paragraphs ───────────────────────────────────────────
      const dateStr = new Date(`${breakdownDate}T00:00:00`)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        })
        .replace(/\//g, "/");

      const para = (text: string, bold = false) =>
        new Paragraph({
          children: [new TextRun({ text, bold, font: "Arial", size: 22 })],
        });

      const blank = () =>
        new Paragraph({ children: [new TextRun({ text: "", size: 22 })] });

      const paragraphs: Paragraph[] = [
        para(selectedMerchant.name.toUpperCase(), true),
        para(dateStr),
        blank(),
      ];

      // Each order
      for (const order of orders) {
        const isFailed = order.fom_delivery_status?.toLowerCase() === "failed";
        const landmark = order.landmark || "—";
        const landmarkPrice = landmarksMap.get(landmark.toLowerCase()) || 0;
        const riderFee = Number(landmarkPrice);
        const landmarkLine = `${landmark} – ₦${riderFee.toLocaleString()}`;
        const amount = isFailed
          ? "" // failed: no amount
          : `₦${Number(order.total_amount || 0).toLocaleString()}`;

        paragraphs.push(para(order.fom_delivery_status!?.toLowerCase(), true));
        paragraphs.push(para(order.customer_name));
        paragraphs.push(para(landmarkLine));

        for (const item of order.items ?? []) {
          paragraphs.push(para(`${item.quantity} ${item.name}`));
        }
        paragraphs.push(para(`Total = ${amount}`, true));
        paragraphs.push(blank());
      }

      // Totals
      const totalOrder = orders
        .filter((o) => o.fom_delivery_status?.toLowerCase() === "delivered")
        .reduce((s, o) => s + Number(o.total_amount || 0), 0);
      const amountPaid = orders
        .filter((o) => o.fom_delivery_status?.toLowerCase() === "delivered")
        .reduce((s, o) => s + Number(o.amount_paid || 0), 0);
      const totalDelivery = orders.reduce((s, o) => {
        const lPrice = landmarksMap.get((o.landmark || "").toLowerCase()) || 0;
        return s + Number(lPrice);
      }, 0);
      const totalBalance = amountPaid - totalDelivery;

      paragraphs.push(para(`Total order = ₦${totalOrder.toLocaleString()}`));
      paragraphs.push(para(`Amount Paid = ₦${amountPaid.toLocaleString()}`));
      paragraphs.push(
        para(`Total Delivery = ₦${totalDelivery.toLocaleString()}`),
      );
      paragraphs.push(para("Total service charge ="));
      paragraphs.push(blank());
      paragraphs.push(blank());
      paragraphs.push(
        para(`Total balance = ₦${totalBalance.toLocaleString()}`, true),
      );
      paragraphs.push(blank());

      // Stock count section
      if (stockLines.length > 0) {
        paragraphs.push(para("Stock count", true));
        for (const line of stockLines) {
          paragraphs.push(para(line));
        }
      }

      const doc = new Document({
        sections: [{ children: paragraphs }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedMerchant.name}_breakdown_${breakdownDate}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Breakdown downloaded as Word document");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Word document");
    } finally {
      setDownloading(false);
    }
  };

  // Group orders by delivery status for summary
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalQty = orders.reduce(
      (sum, o) =>
        sum + (o.items ?? []).reduce((s, i) => s + Number(i.quantity || 0), 0),
      0,
    );
    const totalValue = orders.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0,
    );
    const totalToMerchant = orders.reduce(
      (sum, o) => sum + Number(o.payment_to_merchant || 0),
      0,
    );
    const deliveredCount = orders.filter(
      (o) => o.fom_delivery_status?.toLowerCase() === "delivered",
    ).length;
    const failedCount = orders.filter(
      (o) => o.fom_delivery_status?.toLowerCase() === "failed",
    ).length;
    const pendingCount = orders.filter(
      (o) =>
        !o.fom_delivery_status ||
        !["delivered", "failed", "returned", "canceled", "shelved"].includes(
          o.fom_delivery_status.toLowerCase(),
        ),
    ).length;

    return {
      totalOrders,
      totalQty,
      totalValue,
      totalToMerchant,
      deliveredCount,
      failedCount,
      pendingCount,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Merchant Breakdown
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Select a merchant and date to view a full breakdown of their orders.
        </p>
      </div>

      {/* Controls */}
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="breakdown-date">Breakdown Date</Label>
            <Input
              id="breakdown-date"
              type="date"
              value={breakdownDate}
              onChange={(e) => setBreakdownDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="merchant-select">Merchant</Label>
            {loading ? (
              <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading merchants…
              </div>
            ) : (
              <select
                id="merchant-select"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedMerchantId}
                onChange={(e) => setSelectedMerchantId(e.target.value)}
              >
                <option value="">Select merchant…</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Card>

      {/* Results */}
      {!selectedMerchantId ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Select a merchant above to generate the breakdown.
        </Card>
      ) : ordersLoading ? (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading breakdown…
          </p>
        </Card>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No orders found for{" "}
          <span className="font-semibold">{selectedMerchant?.name}</span> on{" "}
          {new Date(`${breakdownDate}T00:00:00`).toLocaleDateString()}.
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Orders", value: stats.totalOrders },
              { label: "Total Qty", value: stats.totalQty },
              {
                label: "Delivered",
                value: stats.deliveredCount,
                color: "text-emerald-600",
              },
              {
                label: "Failed / Returned",
                value: stats.failedCount,
                color: "text-red-600",
              },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                  className={`text-2xl font-bold mt-1 ${color ?? "text-foreground"}`}
                >
                  {value}
                </p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total Order Value</p>
              <p className="text-xl font-bold mt-1">
                {formatCurrency(stats.totalValue)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">
                Total Payable to Merchant
              </p>
              <p className="text-xl font-bold mt-1 text-primary">
                {formatCurrency(stats.totalToMerchant)}
              </p>
            </Card>
          </div>

          {/* Orders table */}
          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {selectedMerchant?.name} ·{" "}
                {new Date(`${breakdownDate}T00:00:00`).toLocaleDateString()}
              </h2>
              <Button
                onClick={handleDownloadWord}
                disabled={downloading || orders.length === 0}
                variant="outline"
                className="gap-2"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Download as Word
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                      Customer
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                      Products
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                      Qty
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                      Rider
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                      Landmark
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground">
                      Order Total
                    </th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground">
                      Amount Paid
                    </th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground">
                      To Merchant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const statusLower =
                      order.fom_delivery_status?.toLowerCase() || "";
                    const isFailed = statusLower === "failed";
                    const isDelivered = statusLower === "delivered";
                    return (
                      <tr
                        key={order.id}
                        className={`border-t border-border ${
                          isFailed
                            ? "bg-red-50"
                            : isDelivered
                              ? "bg-emerald-50/30"
                              : ""
                        }`}
                      >
                        <td className="p-3 font-medium">
                          {order.customer_name}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-40 truncate">
                          {(order.items ?? [])
                            .map((i) => `${i.quantity}× ${i.name}`)
                            .join(", ")}
                        </td>
                        <td className="p-3 text-center">
                          {(order.items ?? []).reduce(
                            (s, i) => s + Number(i.quantity || 0),
                            0,
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          {order.rider_name || "—"}
                        </td>
                        <td className="p-3 text-xs">{order.landmark || "—"}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              isDelivered
                                ? "bg-emerald-100 text-emerald-700"
                                : isFailed
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.fom_delivery_status ||
                              order.inventory_status ||
                              "pending"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td className="p-3 text-right font-semibold">
                          {formatCurrency(order.amount_paid ?? 0)}
                        </td>
                        <td className="p-3 text-right font-semibold text-primary">
                          {formatCurrency(order.payment_to_merchant ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
