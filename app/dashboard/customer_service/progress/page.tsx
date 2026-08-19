"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, TrendingUp, CheckCircle2, XCircle, Package } from "lucide-react";

interface ProgressEntry {
  product: string;
  totalGiven: number;
  totalSentOut: number;
  totalDelivered: number;
  totalFailed: number;
}

const ORDERS_LIMIT = 5000;

export default function ProgressReportPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [report, setReport] = useState<ProgressEntry[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: merchantData }, { data: productData }, { data: orderData }] =
        await Promise.all([
          supabase!.from("merchants").select("id, name").eq("is_active", true).order("name"),
          supabase!.from("products").select("id, name, merchant_id").order("name"),
          supabase!.from("orders").select("id, created_at, items, status, fom_delivery_status").order("created_at", { ascending: false }).range(0, ORDERS_LIMIT - 1),
        ]);
      if (merchantData) setMerchants(merchantData);
      if (productData) setProducts(productData);
      if (orderData) setOrders(orderData);
    } catch (err) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = useMemo(
    () =>
      selectedMerchant === "all"
        ? products
        : products.filter((p) => p.merchant_id === selectedMerchant),
    [products, selectedMerchant],
  );

  const toggleProduct = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName)
        ? prev.filter((p) => p !== productName)
        : [...prev, productName],
    );
  };

  const selectAll = () => {
    setSelectedProducts(filteredProducts.map((p) => p.name));
  };

  const clearAll = () => {
    setSelectedProducts([]);
  };

  const generateReport = () => {
    if (selectedProducts.length === 0) {
      toast.error("Please select at least one product");
      return;
    }
    setGenerating(true);
    try {
      const result: ProgressEntry[] = selectedProducts.map((productName) => {
        const relevantOrders = orders.filter((o) =>
          ((o.items as any[]) || []).some(
            (item: any) => item.name?.toLowerCase() === productName.toLowerCase(),
          ),
        );

        const sentOut = relevantOrders.filter(
          (o) => o.status === "fom" || o.status === "accounting" || o.status === "warehouse",
        );
        const delivered = relevantOrders.filter(
          (o) => o.fom_delivery_status?.toLowerCase() === "delivered",
        );
        const failed = relevantOrders.filter(
          (o) => o.fom_delivery_status?.toLowerCase() === "failed",
        );

        return {
          product: productName,
          totalGiven: relevantOrders.length,
          totalSentOut: sentOut.length,
          totalDelivered: delivered.length,
          totalFailed: failed.length,
        };
      });

      setReport(result);
      setReportGenerated(true);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const grandTotal = useMemo(() => {
    if (!reportGenerated) return null;
    return {
      totalGiven: report.reduce((s, r) => s + r.totalGiven, 0),
      totalSentOut: report.reduce((s, r) => s + r.totalSentOut, 0),
      totalDelivered: report.reduce((s, r) => s + r.totalDelivered, 0),
      totalFailed: report.reduce((s, r) => s + r.totalFailed, 0),
    };
  }, [report, reportGenerated]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Progress Report</h1>
        <p className="text-muted-foreground mt-2">
          Generate order progress summaries per product for all active merchants.
        </p>
      </div>

      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading data...</p>
        </Card>
      ) : (
        <>
          {/* Filters & Selection */}
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Select Products</h2>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Filter by Merchant:</label>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedMerchant}
                  onChange={(e) => {
                    setSelectedMerchant(e.target.value);
                    setSelectedProducts([]);
                  }}
                >
                  <option value="all">All Merchants</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" variant="outline" onClick={selectAll}>Select All</Button>
              <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.name)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-sm text-left transition-colors ${
                    selectedProducts.includes(p.name)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted/30"
                  }`}
                >
                  <Package className="h-3 w-3 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={generateReport}
                disabled={generating || selectedProducts.length === 0}
                className="gap-2"
              >
                {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                <TrendingUp className="h-4 w-4" />
                Generate Report ({selectedProducts.length} selected)
              </Button>
            </div>
          </Card>

          {/* Report Results */}
          {reportGenerated && (
            <div className="space-y-4">
              {report.map((entry) => (
                <Card key={entry.product} className="p-6">
                  <h3 className="text-base font-bold mb-4 text-foreground">
                    {entry.product}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <p className="text-2xl font-bold">{entry.totalGiven}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Orders Given</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50">
                      <p className="text-2xl font-bold text-blue-700">{entry.totalSentOut}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Sent Out</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-emerald-50">
                      <p className="text-2xl font-bold text-emerald-700">{entry.totalDelivered}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Delivered</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-red-50">
                      <p className="text-2xl font-bold text-red-700">{entry.totalFailed}</p>
                      <p className="text-xs text-muted-foreground mt-1">Failed Deliveries</p>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Grand Total */}
              {grandTotal && (
                <Card className="p-6 border-2 border-primary/30 bg-primary/5">
                  <h3 className="text-base font-bold mb-4">Grand Totals</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-xl bg-muted/30">
                      <p className="text-2xl font-bold">{grandTotal.totalGiven}</p>
                      <p className="text-xs text-muted-foreground mt-1">Grand Total Given</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-blue-50">
                      <p className="text-2xl font-bold text-blue-700">{grandTotal.totalSentOut}</p>
                      <p className="text-xs text-muted-foreground mt-1">Grand Total Sent Out</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-emerald-50">
                      <p className="text-2xl font-bold text-emerald-700">{grandTotal.totalDelivered}</p>
                      <p className="text-xs text-muted-foreground mt-1">Grand Total Delivered</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-red-50">
                      <p className="text-2xl font-bold text-red-700">{grandTotal.totalFailed}</p>
                      <p className="text-xs text-muted-foreground mt-1">Grand Total Failed</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
