"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-context";
import { Loader2, Users, Search, X, FileDown } from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { formatCurrency } from "@/lib/utils";

interface RiderEntry {
  rider: string;
  deliveries: Array<{
    orderId: string;
    customer: string;
    landmark: string;
    status: string;
    riderPay: number;
    isFailed: boolean;
  }>;
  totalPay: number;
  outstanding: number;
  rider_type?: string;
}

export default function RiderPaymentsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [ridersList, setRidersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [outstandingMap, setOutstandingMap] = useState<Record<string, number>>(
    {},
  );
  const [searchRider, setSearchRider] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleDownloadWord = async () => {
    if (riderGroups.length === 0) return;
    setDownloading(true);

    try {
      const dateStr = new Date(`${dateFilter}T00:00:00`)
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
        para(`RIDER PAYMENTS - ${dateStr}`, true),
        blank(),
      ];

      for (const group of riderGroups) {
        const validStatuses = ["delivered", "failed"];
        const docDeliveries = group.deliveries.filter((d) =>
          validStatuses.includes(d.status.toLowerCase())
        );

        if (docDeliveries.length === 0) continue;

        paragraphs.push(para(group.rider.toUpperCase(), true));
        paragraphs.push(blank());

        let totalPayForDoc = 0;

        for (const d of docDeliveries) {
          const statusText = d.isFailed ? "failed" : d.status.toLowerCase();
          const line = `${d.landmark} – ${d.riderPay.toLocaleString()}`;
          paragraphs.push(para(statusText, true));
          paragraphs.push(para(d.customer));
          paragraphs.push(para(line));
          paragraphs.push(blank());
          totalPayForDoc += d.riderPay;
        }

        const outstanding = group.outstanding;
        const netPay = totalPayForDoc - outstanding;

        paragraphs.push(para(`Total Pay = ${totalPayForDoc.toLocaleString()}`));
        if (outstanding > 0) {
          paragraphs.push(para(`Outstanding = -${outstanding.toLocaleString()}`));
        }
        paragraphs.push(para(`Net Amount Payable = ${netPay.toLocaleString()}`, true));
        paragraphs.push(blank());
        paragraphs.push(blank());
      }

      const doc = new Document({
        sections: [{ children: paragraphs }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rider_Payments_${dateFilter}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Payments downloaded as Word document");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Word document");
    } finally {
      setDownloading(false);
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const startOfDay = new Date(`${dateFilter}T05:00:00`);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const { data, error } = await supabase!
        .from("orders")
        .select("*")
        .not("rider_name", "is", null)
        .gte("rider_assigned_at", startOfDay.toISOString())
        .lt("rider_assigned_at", endOfDay.toISOString())
        .order("rider_assigned_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);

      const { data: ridersData } = await supabase!.from("riders").select("*");
      if (ridersData) setRidersList(ridersData);

    } catch (err) {
      toast.error("Failed to load rider data");
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const riderGroups = useMemo((): RiderEntry[] => {
    const map: Record<string, RiderEntry> = {};

    for (const order of orders) {
      const rider = order.rider_name || "Unknown";
      if (!map[rider]) {
        const foundRider = ridersList.find(r => r.name === rider);
        map[rider] = {
          rider,
          rider_type: foundRider?.rider_type || "external",
          deliveries: [],
          totalPay: 0,
          outstanding: outstandingMap[rider] || 0,
        };
      }

      const statusLower = (order.fom_delivery_status || "pending").toLowerCase();
      const isFailed = statusLower === "failed";
      const isDelivered = statusLower === "delivered";
      const fullLandmark = Number(order.payment_to_rider || 0);
      const riderPay = (isDelivered || isFailed) ? fullLandmark : 0;

      map[rider].deliveries.push({
        orderId: order.id,
        customer: order.customer_name,
        landmark: order.landmark || order.delivery_address || "—",
        status: order.fom_delivery_status || "pending",
        riderPay,
        isFailed,
      });

      map[rider].totalPay += riderPay;
    }

    // Apply outstanding
    return Object.values(map).map((entry) => ({
      ...entry,
      outstanding: outstandingMap[entry.rider] || 0,
    }));
  }, [orders, outstandingMap, ridersList]);

  const grandTotal = useMemo(
    () => riderGroups.reduce((s, r) => s + r.totalPay - r.outstanding, 0),
    [riderGroups],
  );

  const filteredRiderGroups = useMemo(() => {
    const term = searchRider.trim().toLowerCase();
    if (!term) return riderGroups;
    return riderGroups.filter((r) => r.rider.toLowerCase().includes(term));
  }, [riderGroups, searchRider]);

  const updateOutstanding = (rider: string, value: string) => {
    setOutstandingMap((prev) => ({ ...prev, [rider]: Number(value) || 0 }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rider Payments</h1>
          <p className="text-muted-foreground mt-2">
            Calculate and review how much each rider should be paid based on
            deliveries and failed attempts.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Date:</Label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 w-44"
            />
          </div>
          <Button
            onClick={handleDownloadWord}
            disabled={downloading || riderGroups.length === 0}
            variant="outline"
            className="gap-2"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            Download Report
          </Button>

          {/* Rider search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search rider…"
              value={searchRider}
              onChange={(e) => setSearchRider(e.target.value)}
              className="pl-9 pr-8 h-9 w-48"
            />
            {searchRider && (
              <button
                onClick={() => setSearchRider("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading rider data...
          </p>
        </Card>
      ) : riderGroups.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No rider assignments found for this date.
          </p>
        </Card>
      ) : (
        <>
          {/* Header summary strip */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Total Company Payout
              </p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(grandTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Riders</p>
              <p className="text-2xl font-bold">{riderGroups.length}</p>
            </div>
          </div>

          {/* Rider Cards */}
          <div className="space-y-4">
            {filteredRiderGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No riders match &ldquo;{searchRider}&rdquo;.
              </div>
            ) : (
              filteredRiderGroups.map((entry) => {
                const netPay =
                  entry.totalPay - (outstandingMap[entry.rider] || 0);
                return (
                  <Card key={entry.rider} className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-foreground">
                          {entry.rider}
                        </h2>
                        {entry.rider_type === "in-house" && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            In-House
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            Net Pay
                          </p>
                          <p className="text-lg font-bold text-emerald-700">
                            {formatCurrency(netPay)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Deliveries table */}
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                              #
                            </th>
                            <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                              Customer
                            </th>
                            <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                              Location
                            </th>
                            <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                              Status
                            </th>
                            <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                              Rider Pay
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.deliveries.map((d, i) => (
                            <tr
                              key={d.orderId}
                              className={`border-t border-border ${d.isFailed ? "bg-red-50" : ""}`}
                            >
                              <td className="p-3 text-muted-foreground text-xs">
                                {i + 1}
                              </td>
                              <td className="p-3 font-medium">{d.customer}</td>
                              <td className="p-3 text-muted-foreground text-xs">
                                {d.landmark}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${d.isFailed || ["failed", "returned", "cancelled"].includes(d.status.toLowerCase())
                                      ? "bg-red-100 text-red-700"
                                      : d.status.toLowerCase() === "delivered"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                >
                                  {d.isFailed ? "Failed" : d.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-semibold">
                                {formatCurrency(d.riderPay)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pay summary */}
                    <div className="rounded-xl bg-muted/20 p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Subtotal ({entry.deliveries.length} deliveries)
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(entry.totalPay)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-muted-foreground">
                          Outstanding balance
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            ₦
                          </span>
                          <Input
                            type="number"
                            className="h-7 w-28 text-sm"
                            placeholder="0"
                            value={outstandingMap[entry.rider] || ""}
                            onChange={(e) =>
                              updateOutstanding(entry.rider, e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="border-t border-border pt-2 flex justify-between text-base">
                        <span className="font-bold">Net Amount Payable</span>
                        <span className="font-bold text-emerald-700">
                          {formatCurrency(netPay)}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
