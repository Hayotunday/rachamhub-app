"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { ExtractedOrder, GeminiResponse } from "@/lib/types";
import { AlertCircle, CheckCircle2, Loader2, Save, Upload } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function OrderExtractionForm() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedOrder | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  const extractOrderFromText = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Validate input
      if (!text.trim()) {
        setError("Please enter order text to extract");
        setIsLoading(false);
        return;
      }

      console.log("[v0] Calling Gemini API for order extraction...");

      // Call Gemini API via route handler
      const response = await fetch("/api/gemini/extract-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract order");
      }

      const result: GeminiResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "No order data extracted");
      }

      console.log("[v0] Extracted order data:", result.data);
      setExtractedData(result.data);
      setSuccess(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to extract order";
      setError(message);
      console.error("[Order Extraction] Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveExtractedOrder = async () => {
    if (!extractedData || !user) return;

    setError(null);
    setIsLoading(true);

    try {
      console.log("[v0] Saving extracted order to Firestore...");

      // Save to Firestore
      const ordersRef = collection(db!, "orders");
      const orderData = {
        customerId: extractedData.customerId,
        customerName: extractedData.customerName,
        items: extractedData.items,
        totalAmount: extractedData.totalAmount,
        status: "pending" as const,
        notes: extractedData.notes,
        extractedBy: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(ordersRef, orderData);

      console.log("[v0] Order saved successfully");
      setSuccess(true);
      setText("");
      setExtractedData(null);

      // Reset success message after 3 seconds
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
          </div>

          <div className="flex gap-3">
            <Button
              onClick={extractOrderFromText}
              disabled={isLoading || !text.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Extract with AI
                </>
              )}
            </Button>
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

      {/* Extracted Data Preview */}
      {extractedData && (
        <Card className="p-6 bg-accent/5 border-primary/20">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Extracted Order Details
          </h2>

          <div className="space-y-4">
            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Customer Name
                </label>
                <p className="text-foreground font-medium">
                  {extractedData.customerName}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Customer ID
                </label>
                <p className="text-foreground font-medium">
                  {extractedData.customerId}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Order Items
              </label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">
                        Item Name
                      </th>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">
                        Quantity
                      </th>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">
                        Weight
                      </th>
                      <th className="text-left py-2 text-xs font-semibold text-muted-foreground">
                        Dimensions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedData.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-3 text-foreground">{item.name}</td>
                        <td className="py-3 text-foreground">
                          {item.quantity}
                        </td>
                        <td className="py-3 text-foreground">
                          {item.weight || "—"}
                        </td>
                        <td className="py-3 text-foreground">
                          {item.dimensions || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Amount */}
            <div className="pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Amount
                </span>
                <span className="text-2xl font-bold text-primary">
                  ₦{extractedData.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Notes */}
            {extractedData.notes && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Notes
                </label>
                <p className="text-sm text-foreground bg-background/50 p-3 rounded border border-border">
                  {extractedData.notes}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <Button
                onClick={saveExtractedOrder}
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Order
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setExtractedData(null);
                  setText("");
                }}
                disabled={isLoading}
                className="flex-1"
              >
                Extract Another
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

// Missing import - add this
import { Zap } from "lucide-react";
