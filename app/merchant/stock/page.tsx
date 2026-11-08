"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Loader2, Package, Clock, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMerchantSession } from "@/components/merchant-session-provider";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};

export default function MerchantStockPage() {
  const { role } = useMerchantSession();

  const [merchants, setMerchants] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stockEntries, setStockEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [selectedMerchant, setSelectedMerchant] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const filteredProducts = useMemo(
    () => products.filter((p) => p.merchant_id === selectedMerchant),
    [products, selectedMerchant],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Only fetch approved merchants and products for stock addition
      const [
        { data: merchantData },
        { data: productData },
        { data: entryData },
      ] = await Promise.all([
        supabase!
          .from("merchants")
          .select("id, name, approval_status")
          .order("name"),
        supabase!
          .from("products")
          .select("id, name, price, merchant_id, approval_status")
          .order("name"),
        supabase!
          .from("stock_entries")
          .select("*, products(name, price), merchants(name)")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (merchantData) {
        setMerchants(
          merchantData.filter(
            (m: any) => !m.approval_status || m.approval_status === "approved",
          ),
        );
      }
      if (productData) {
        setProducts(
          productData.filter(
            (p: any) => !p.approval_status || p.approval_status === "approved",
          ),
        );
      }
      if (entryData) setStockEntries(entryData);
    } catch (err) {
      toast.error("Failed to load stock data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitStock = async () => {
    if (!selectedMerchant || !selectedProduct || !quantity) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase!.auth.getUser();
      const userId = user?.id ?? null;

      const { error } = await supabase!.from("stock_entries").insert([
        {
          merchant_id: selectedMerchant,
          product_id: selectedProduct,
          quantity: Number(quantity),
          notes: notes || null,
          status: "pending",
          submitted_by: userId,
          submitted_by_role: role,
          admin_approved: role === "admin",
          warehouse_approved: role === "warehouse",
        },
      ]);
      if (error) throw error;

      toast.success(
        role === "guest"
          ? "Stock entry submitted — awaiting Admin & Warehouse approval"
          : `Stock entry submitted — awaiting ${role === "admin" ? "Warehouse" : "Admin"} approval`,
      );
      setAddDialogOpen(false);
      setSelectedMerchant("");
      setSelectedProduct("");
      setQuantity("");
      setNotes("");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = stockEntries.filter(
    (e) => e.status === "pending",
  ).length;
  const approvedCount = stockEntries.filter(
    (e) => e.status === "approved",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Stock Addition</h1>
          <p className="text-slate-500 mt-2">
            Submit inbound stock entries for merchants.
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Stock Entry
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 flex items-center justify-between border-0 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Total Entries</p>
            <p className="text-2xl font-bold mt-1 text-slate-900">
              {stockEntries.length}
            </p>
          </div>
          <Package className="h-6 w-6 text-primary" />
        </Card>
        <Card className="p-6 flex items-center justify-between border-0 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Pending Approval</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">
              {pendingCount}
            </p>
          </div>
          <Clock className="h-6 w-6 text-amber-600" />
        </Card>
        <Card className="p-6 flex items-center justify-between border-0 shadow-sm">
          <div>
            <p className="text-sm text-slate-500">Approved</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">
              {approvedCount}
            </p>
          </div>
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </Card>
      </div>

      {/* Stock Entries List */}
      <Card className="p-6 border-0 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-slate-900">
          Recent Stock Entries
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : stockEntries.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-12">
            No stock entries yet. Add the first one above.
          </p>
        ) : (
          <div className="space-y-3">
            {stockEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Merchant</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.merchants?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Product</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {entry.products?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Quantity Added</p>
                    <p className="text-sm font-bold text-primary">
                      +{entry.quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p className="text-xs text-slate-500">
                      {new Date(entry.created_at).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${STATUS_STYLES[entry.status] || "bg-gray-100 text-gray-600"}`}
                  >
                    {entry.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Stock Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock Entry</DialogTitle>
            <DialogDescription>
              Select a merchant and product to add inbound stock. Entries are
              pending until approved by an authorized user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Merchant *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={selectedMerchant}
                onChange={(e) => {
                  setSelectedMerchant(e.target.value);
                  setSelectedProduct("");
                }}
              >
                <option value="">Select merchant...</option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Product *</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                disabled={!selectedMerchant}
              >
                <option value="">
                  {selectedMerchant
                    ? "Select product..."
                    : "Select a merchant first"}
                </option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — ₦{Number(p.price).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Quantity Added *</Label>
              <Input
                type="number"
                placeholder="e.g. 50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any notes about this stock batch..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitStock} disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
