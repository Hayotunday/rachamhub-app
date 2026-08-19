"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Check, X, Store, Package, Archive, Pencil, Trash2 } from "lucide-react";
import { useMerchantSession } from "@/components/merchant-session-provider";

export default function MerchantApprovalsPage() {
  const { role } = useMerchantSession();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("merchants");
  const [pendingMerchants, setPendingMerchants] = useState<any[]>([]);
  const [pendingProducts, setPendingProducts] = useState<any[]>([]);
  const [pendingStock, setPendingStock] = useState<any[]>([]);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"merchants" | "products" | "stock" | null>(null);
  const [editMerchantName, setEditMerchantName] = useState("");
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [editStockQuantity, setEditStockQuantity] = useState("");

  const fetchPendingItems = useCallback(async () => {
    setLoading(true);
    try {
      const [merchantsRes, productsRes, stockRes] = await Promise.all([
        supabase!
          .from("merchants")
          .select("id, name, submitted_by_role, admin_approved, warehouse_approved, customer_service_approved, approval_status")
          .eq("approval_status", "pending"),
        supabase!
          .from("products")
          .select("id, name, price, submitted_by_role, admin_approved, warehouse_approved, customer_service_approved, approval_status, merchants(name)")
          .eq("approval_status", "pending"),
        supabase!
          .from("stock_entries")
          .select("id, quantity, submitted_by_role, admin_approved, warehouse_approved, customer_service_approved, status, products(name), merchants(name)")
          .eq("status", "pending"),
      ]);

      if (merchantsRes.data) setPendingMerchants(merchantsRes.data);
      if (productsRes.data) setPendingProducts(productsRes.data);
      if (stockRes.data) setPendingStock(stockRes.data);
    } catch (err) {
      toast.error("Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingItems();
  }, [fetchPendingItems]);

  const canApprove = (item: any) => {
    if (role === "admin" && !item.admin_approved) return true;
    if (role === "warehouse" && !item.warehouse_approved) return true;
    if (
      role === "customer_service" &&
      item.admin_approved &&
      item.warehouse_approved &&
      !item.customer_service_approved
    ) {
      return true;
    }
    return false;
  };

  const handleApprove = async (table: string, item: any) => {
    const { data: { user } } = await supabase!.auth.getUser();
    const userId = user?.id ?? null;

    const isNowAdminApproved = role === "admin" ? userId : item.admin_approved ?? null;
    const isNowWarehouseApproved = role === "warehouse" ? userId : item.warehouse_approved ?? null;
    const isNowCustomerServiceApproved =
      role === "customer_service" ? userId : item.customer_service_approved ?? null;
    const isFullyApproved =
      !!isNowAdminApproved &&
      !!isNowWarehouseApproved &&
      !!isNowCustomerServiceApproved;

    const updates: any = {
      admin_approved: isNowAdminApproved,
      warehouse_approved: isNowWarehouseApproved,
      customer_service_approved: isNowCustomerServiceApproved,
    };

    if (table === "stock_entries") {
      if (isFullyApproved) {
        updates.status = "approved";
        updates.approved_at = new Date().toISOString();
      }
    } else {
      if (isFullyApproved) {
        updates.approval_status = "approved";
      }
    }

    try {
      const { error } = await supabase!
        .from(table)
        .update(updates)
        .eq("id", item.id);
      if (error) throw error;
      toast.success(
        isFullyApproved
          ? "Item fully approved and went live!"
          : "Your approval was recorded.",
      );
      fetchPendingItems();
    } catch (err) {
      toast.error("Failed to approve item");
    }
  };

  const handleReject = async (table: string, itemId: string) => {
    const updates: any = {};
    if (table === "stock_entries") {
      updates.status = "rejected";
    } else {
      updates.approval_status = "rejected";
    }

    try {
      const { error } = await supabase!
        .from(table)
        .update(updates)
        .eq("id", itemId);
      if (error) throw error;
      toast.success("Item rejected");
      fetchPendingItems();
    } catch (err) {
      toast.error("Failed to reject item");
    }
  };

  const handleEditSave = async () => {
    if (!editingId || !editingType) return;

    let table = "";
    let updates: any = {};

    if (editingType === "merchants") {
      table = "merchants";
      if (!editMerchantName) return toast.error("Name required");
      updates = { name: editMerchantName };
    } else if (editingType === "products") {
      table = "products";
      if (!editProductName || !editProductPrice) return toast.error("Name and price required");
      updates = { name: editProductName, price: Number(editProductPrice) };
    } else if (editingType === "stock") {
      table = "stock_entries";
      if (!editStockQuantity) return toast.error("Quantity required");
      updates = { quantity: Number(editStockQuantity) };
    }

    try {
      const { error } = await supabase!.from(table).update(updates).eq("id", editingId);
      if (error) throw error;
      toast.success("Item updated");
      setEditingId(null);
      setEditingType(null);
      fetchPendingItems();
    } catch (err) {
      toast.error("Failed to update item");
    }
  };

  const handleDelete = async (table: string, itemId: string) => {
    if (!confirm("Are you sure you want to completely delete this entry?")) return;
    try {
      const { error } = await supabase!.from(table).delete().eq("id", itemId);
      if (error) throw error;
      toast.success("Entry deleted");
      fetchPendingItems();
    } catch (err) {
      toast.error("Failed to delete entry");
    }
  };

  const ApprovalBadge = ({
    admin,
    warehouse,
    customerService,
  }: {
    admin: string | null;
    warehouse: string | null;
    customerService: string | null;
  }) => (
    <div className="flex gap-2 text-[10px] font-semibold uppercase">
      <span
        className={`px-2 py-0.5 rounded-full ${admin ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
      >
        Admin: {admin ? "Yes" : "No"}
      </span>
      <span
        className={`px-2 py-0.5 rounded-full ${warehouse ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
      >
        WH: {warehouse ? "Yes" : "No"}
      </span>
      <span
        className={`px-2 py-0.5 rounded-full ${customerService ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
      >
        CS: {customerService ? "Yes" : "No"}
      </span>
    </div>
  );

  /** Small numeric badge shown on each tab trigger */
  const CountBadge = ({ count }: { count: number }) =>
    count === 0 ? null : (
      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">
        {count}
      </span>
    );

  if (role !== "admin" && role !== "warehouse" && role !== "customer_service") {
    return (
      <div className="p-12 text-center text-slate-500">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Pending Approvals</h1>
        <p className="text-slate-500 mt-2">
          Review and approve changes made by Guests, or co-approve actions from
          other managers.
        </p>
      </div>

      {loading ? (
        <Card className="p-12 text-center border-0 shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-slate-500">
            Loading pending items...
          </p>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="merchants" className="gap-1.5">
              <Store className="h-4 w-4" />
              Merchants
              <CountBadge count={pendingMerchants.length} />
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="h-4 w-4" />
              Products
              <CountBadge count={pendingProducts.length} />
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-1.5">
              <Archive className="h-4 w-4" />
              Stock Additions
              <CountBadge count={pendingStock.length} />
            </TabsTrigger>
          </TabsList>

          {/* ── Merchants tab ── */}
          <TabsContent value="merchants" className="space-y-4">
            {pendingMerchants.length === 0 ? (
              <Card className="p-12 text-center border-0 shadow-sm">
                <Store className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No pending merchants.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingMerchants.map((merchant) => (
                  <Card
                    key={merchant.id}
                    className="p-4 flex items-center justify-between border-0 shadow-sm"
                  >
                    <div className="flex-1">
                      {editingId === merchant.id && editingType === "merchants" ? (
                        <div className="flex gap-2 items-center mb-1">
                          <Input
                            value={editMerchantName}
                            onChange={(e) => setEditMerchantName(e.target.value)}
                            className="h-8 max-w-[200px]"
                            placeholder="Merchant Name"
                          />
                          <Button size="sm" onClick={handleEditSave}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <p className="font-semibold text-slate-900">{merchant.name}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        Submitted by:{" "}
                        <span className="capitalize">
                          {merchant.submitted_by_role}
                        </span>
                      </p>
                      <div className="mt-2">
                        <ApprovalBadge
                          admin={merchant.admin_approved}
                          warehouse={merchant.warehouse_approved}
                          customerService={merchant.customer_service_approved}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap justify-end pl-4">
                      {canApprove(merchant) && (
                        <>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="text-emerald-600 hover:bg-emerald-50"
                            onClick={() => handleApprove("merchants", merchant)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleReject("merchants", merchant.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="text-slate-600 hover:bg-slate-50"
                        onClick={() => {
                          setEditingId(merchant.id);
                          setEditingType("merchants");
                          setEditMerchantName(merchant.name);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete("merchants", merchant.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Products tab ── */}
          <TabsContent value="products" className="space-y-4">
            {pendingProducts.length === 0 ? (
              <Card className="p-12 text-center border-0 shadow-sm">
                <Package className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">No pending products.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="p-4 flex flex-col justify-between border-0 shadow-sm"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {editingId === product.id && editingType === "products" ? (
                            <div className="flex gap-2 items-center mb-2 flex-wrap">
                              <Input
                                value={editProductName}
                                onChange={(e) => setEditProductName(e.target.value)}
                                className="h-8 max-w-[150px]"
                                placeholder="Product Name"
                              />
                              <Input
                                type="number"
                                value={editProductPrice}
                                onChange={(e) => setEditProductPrice(e.target.value)}
                                className="h-8 w-24"
                                placeholder="Price"
                              />
                              <Button size="sm" onClick={handleEditSave}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <>
                              <p className="font-semibold text-slate-900">
                                {product.name}
                              </p>
                              <p className="text-xs text-primary font-mono font-medium">
                                ₦{Number(product.price).toLocaleString()}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex gap-1 pl-2">
                          {canApprove(product) && (
                            <>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                onClick={() => handleApprove("products", product)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() =>
                                  handleReject("products", product.id)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-slate-600 hover:bg-slate-50"
                            onClick={() => {
                              setEditingId(product.id);
                              setEditingType("products");
                              setEditProductName(product.name);
                              setEditProductPrice(product.price);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDelete("products", product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Merchant: {product.merchants?.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Submitted by:{" "}
                        <span className="capitalize">
                          {product.submitted_by_role}
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <ApprovalBadge
                        admin={product.admin_approved}
                        warehouse={product.warehouse_approved}
                        customerService={product.customer_service_approved}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Stock Additions tab ── */}
          <TabsContent value="stock" className="space-y-3">
            {pendingStock.length === 0 ? (
              <Card className="p-12 text-center border-0 shadow-sm">
                <Archive className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">
                  No pending stock entries.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                {pendingStock.map((entry) => (
                  <Card
                    key={entry.id}
                    className="p-4 flex items-center justify-between border-0 shadow-sm"
                  >
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Merchant</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {entry.merchants?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Product</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {entry.products?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Quantity</p>
                        {editingId === entry.id && editingType === "stock" ? (
                          <div className="flex gap-2 items-center mt-1">
                            <Input
                              type="number"
                              value={editStockQuantity}
                              onChange={(e) => setEditStockQuantity(e.target.value)}
                              className="h-8 w-20"
                            />
                            <Button size="icon-sm" onClick={handleEditSave}><Check className="h-3 w-3" /></Button>
                            <Button size="icon-sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-primary">
                            +{entry.quantity}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Submitted By</p>
                        <p className="text-sm font-semibold text-slate-700 capitalize">
                          {entry.submitted_by_role}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <ApprovalBadge
                        admin={entry.admin_approved}
                        warehouse={entry.warehouse_approved}
                        customerService={entry.customer_service_approved}
                      />
                      <div className="flex gap-2 pl-4 border-l items-center flex-wrap">
                        {canApprove(entry) && (
                          <>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() =>
                                handleApprove("stock_entries", entry)
                              }
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() =>
                                handleReject("stock_entries", entry.id)
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="text-slate-600 hover:bg-slate-50"
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditingType("stock");
                            setEditStockQuantity(entry.quantity);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDelete("stock_entries", entry.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
