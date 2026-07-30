"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { ExtractedOrder, GeminiResponse } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const AI_KEYS = [
  { id: "DEFAULT", label: "Extract with AI 1" },
  { id: "I", label: "Extract with AI 2" },
  { id: "II", label: "Extract with AI 3" },
  { id: "III", label: "Extract with AI 4" },
  { id: "IV", label: "Extract with AI 5" },
  { id: "V", label: "Extract with AI 6" },
  { id: "VI", label: "Extract with AI 7" },
  { id: "VII", label: "Extract with AI 8" },
  { id: "VIII", label: "Extract with AI 9" },
  { id: "IX", label: "Extract with AI 10" },
];

export default function OrderExtractionForm() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reviewData, setReviewData] = useState<ExtractedOrder | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [orderPrefix, setOrderPrefix] = useState("RCH-");
  const [extractingKeyId, setExtractingKeyId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchConfig = async () => {
      if (!supabase) return;

      const [{ data: merchantsData }, { data: settingsData }] =
        await Promise.all([
          supabase.from("merchants").select("name").eq("is_active", true),
          supabase
            .from("settings")
            .select("key, value")
            .in("key", ["order_prefix"]),
        ]);

      if (merchantsData) {
        setMerchantOptions(
          merchantsData.map((row: any) => row.name).filter(Boolean),
        );
      }

      if (settingsData) {
        const prefixRow = settingsData.find(
          (row: any) => row.key === "order_prefix",
        );
        if (prefixRow?.value) {
          setOrderPrefix(prefixRow.value);
        }
      }
    };

    fetchConfig();
  }, []);

  const extractOrderFromText = async (keyId: string) => {
    setError(null);
    setIsLoading(true);
    setExtractingKeyId(keyId);

    try {
      // Validate input
      if (!text.trim()) {
        setError("Please enter order text to extract");
        setIsLoading(false);
        setExtractingKeyId(null);
        return;
      }

      // Call Gemini API via route handler
      const response = await fetch("/api/gemini/extract-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), apiKeyId: keyId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract order");
      }

      const result: GeminiResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "No order data extracted");
      }

      setReviewData(result.data);
      setIsReviewOpen(true);
      setSuccess(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to extract order";
      setError(message);
      console.error("[Order Extraction] Error:", err);
    } finally {
      setIsLoading(false);
      setExtractingKeyId(null);
    }
  };

  const saveExtractedOrder = async () => {
    const orderToSave = reviewData;
    if (!orderToSave || !user) return;

    if (!orderToSave.merchant?.trim()) {
      setError("Merchant is required before submitting the order.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      if (!supabase) throw new Error("Supabase client is not initialized.");

      const orderData = {
        customer_name: orderToSave.customerName,
        delivery_address: orderToSave.deliveryAddress,
        phone_numbers: orderToSave.phoneNumbers,
        merchant: orderToSave.merchant,
        cc_comment: orderToSave.comment,
        items: orderToSave.items,
        total_amount: orderToSave.totalAmount,
        inventory_status: "pending",
        fom_delivery_status: "pending",
        warehouse_status: "unpacked",
        extracted_by: user.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any;

      const { error } = await supabase.from("orders").insert([orderData]);
      if (error) throw error;

      setSuccess(true);
      setIsReviewOpen(false);
      setReviewData(null);
      setText("");

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save order";
      setError(message);
      console.error("[Order Extraction] Save error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateReviewField = (key: keyof ExtractedOrder, value: any) => {
    setReviewData((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value } as ExtractedOrder;
    });
  };

  const updateReviewItem = (index: number, key: string, value: any) => {
    setReviewData((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) =>
        i === index ? { ...it, [key]: value } : it,
      );
      return { ...prev, items } as ExtractedOrder;
    });
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Paste Order Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Order Text
            </label>
            <Textarea
              placeholder={`Example: Customer John Smith, 5 boxes of Product A, 3 units of Product B, total $500\n\nPaste any order information here and AI will extract details...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLoading}
              className="min-h-32 font-mono text-sm"
            />
            <p className="italic text-xs aliased text-muted-foreground mt-1">
              Note: While AI text tools offer speed, they often make mistakes by
              inventing facts, using a robotic tone, and distorting your
              original meaning.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {AI_KEYS.map((key) => (
              <Button
                key={key.id}
                onClick={() => extractOrderFromText(key.id)}
                disabled={isLoading || !text.trim()}
                variant="outline"
                className="bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
              >
                {isLoading && extractingKeyId === key.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    {key.label}
                  </>
                )}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/30 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-sm text-destructive/80">{error}</p>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {success && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 p-4 flex gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Order saved successfully!
            </p>
            <p className="text-sm text-green-600/80 dark:text-green-400/80">
              The order has been added to the system and is ready for
              processing.
            </p>
          </div>
        </Card>
      )}

      {/* Extracted Data Review */}
      {reviewData && (
        <Card className="space-y-6 border bg-background shadow-sm">
          <div className="flex flex-col gap-3 border-b border-muted/20 bg-muted px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">
                Review extracted order
              </p>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Verify and update the AI extraction before submitting the order.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => setReviewData(null)}
                disabled={isLoading}
              >
                Clear review
              </Button>
              <Button
                onClick={saveExtractedOrder}
                className="bg-primary hover:bg-primary/90"
                disabled={isLoading || !reviewData.merchant?.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Submit Order"
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 px-6 pb-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Customer Name
                </label>
                <Input
                  value={reviewData.customerName ?? ""}
                  onChange={(e) =>
                    updateReviewField("customerName", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Phone Numbers
                </label>
                <Textarea
                  value={
                    Array.isArray(reviewData.phoneNumbers)
                      ? reviewData.phoneNumbers.join(", ")
                      : ""
                  }
                  onChange={(e) =>
                    updateReviewField(
                      "phoneNumbers",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Merchant
                </label>
                {merchantOptions.length > 0 ? (
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                    value={reviewData.merchant ?? ""}
                    onChange={(e) =>
                      updateReviewField("merchant", e.target.value)
                    }
                  >
                    <option value="" disabled>
                      Select merchant
                    </option>
                    {merchantOptions.map((merchant) => (
                      <option key={merchant} value={merchant}>
                        {merchant}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={reviewData.merchant ?? ""}
                    onChange={(e) =>
                      updateReviewField("merchant", e.target.value)
                    }
                  />
                )}
                {!reviewData.merchant?.trim() && (
                  <p className="text-sm text-destructive">
                    Merchant is required before submitting.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Delivery Address
                </label>
                <Textarea
                  value={reviewData.deliveryAddress ?? ""}
                  onChange={(e) =>
                    updateReviewField("deliveryAddress", e.target.value)
                  }
                  className="min-h-24"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Total Amount (₦)
                </label>
                <Input
                  type="number"
                  value={String(reviewData.totalAmount ?? 0)}
                  onChange={(e) =>
                    updateReviewField(
                      "totalAmount",
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Comment
                </label>
                <Input
                  value={reviewData.comment ?? ""}
                  onChange={(e) => updateReviewField("comment", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto px-6 pb-6">
            <Table className="w-full text-sm">
              <TableHead>
                <TableRow className="text-left text-muted-foreground">
                  <TableCell className="px-2 py-2">Product</TableCell>
                  <TableCell className="px-2 py-2">Quantity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reviewData.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="px-2 py-2">
                      <Input
                        value={item.name}
                        onChange={(e) =>
                          updateReviewItem(idx, "name", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <Input
                        type="number"
                        value={String(item.quantity)}
                        onChange={(e) =>
                          updateReviewItem(
                            idx,
                            "quantity",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t border-muted/20 bg-muted px-6 py-4 sm:flex-row sm:justify-between sm:items-center">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Review the order details and submit when ready.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => setReviewData(null)}
                disabled={isLoading}
              >
                Clear review
              </Button>
              <Button
                onClick={saveExtractedOrder}
                className="bg-primary hover:bg-primary/90"
                disabled={isLoading || !reviewData.merchant?.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Submit Order"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Help Section */}
      <Card className="p-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-foreground mb-2">
          💡 Tips for Best Results
        </h3>
        <ul className="text-sm text-foreground/80 space-y-1 list-disc list-inside">
          <li>Include customer name and order items clearly</li>
          <li>Mention quantities for each item</li>
          <li>Include total amount if available</li>
          <li>
            The AI will extract and structure the information automatically
          </li>
        </ul>
      </Card>
    </div>
  );
}
