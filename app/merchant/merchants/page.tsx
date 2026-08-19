"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  Store,
  Plus,
  Package,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";
import { useMerchantSession } from "@/components/merchant-session-provider";

export default function MerchantsProductsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [products, setProducts] = useState<Record<string, any[]>>({});
  const [productCounts, setProductCounts] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [newMerchant, setNewMerchant] = useState("");
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);

  // Merchant-level search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "approved" | "pending"
  >("all");

  // Per-merchant product search & status filter
  const [productSearches, setProductSearches] = useState<
    Record<string, string>
  >({});
  const [productStatusFilters, setProductStatusFilters] = useState<
    Record<string, "all" | "approved" | "pending">
  >({});

  // Add Product State
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");

  // Edit Product State
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");

  // Edit Merchant State
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(
    null,
  );
  const [editMerchantName, setEditMerchantName] = useState("");

  const { role } = useMerchantSession();

  const fetchMerchants = async () => {
    setLoading(true);
    const { data } = await supabase!
      .from("merchants")
      .select("id, name, approval_status, created_at")
      .order("created_at", { ascending: false });
    if (data) {
      setMerchants(data);
      // Fetch product counts for all merchants in one go
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (m: any) => {
          const { count } = await supabase!
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("merchant_id", m.id);
          counts[m.id] = count ?? 0;
        }),
      );
      setProductCounts(counts);
    }
    setLoading(false);
  };

  const fetchProducts = async (merchantId: string) => {
    const { data } = await supabase!
      .from("products")
      .select("id, name, price, approval_status, merchant_id, created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    if (data) {
      setProducts((prev) => ({ ...prev, [merchantId]: data }));
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleToggleMerchant = (merchantId: string) => {
    if (expandedMerchant === merchantId) {
      setExpandedMerchant(null);
    } else {
      setExpandedMerchant(merchantId);
      fetchProducts(merchantId);
    }
  };

  const getApprovalFields = async () => {
    const {
      data: { user },
    } = await supabase!.auth.getUser();
    const userId = user?.id ?? null;
    return {
      approval_status: "pending",
      admin_approved: role === "admin" ? userId : null,
      warehouse_approved: role === "warehouse" ? userId : null,
      submitted_by: userId,
      submitted_by_role: role,
    };
  };

  const handleAddMerchant = async () => {
    if (!newMerchant) return;
    const approvalFields = await getApprovalFields();
    const { error } = await supabase!
      .from("merchants")
      .insert([{ name: newMerchant, ...approvalFields }]);

    if (error) toast.error("Failed to add merchant");
    else {
      toast.success(
        role === "guest"
          ? "Merchant added — awaiting Admin & Warehouse approval"
          : `Merchant added — awaiting ${role === "admin" ? "Warehouse" : "Admin"} approval`,
      );
      setNewMerchant("");
      fetchMerchants();
    }
  };

  const handleAddProduct = async (merchantId: string) => {
    if (!newProductName || !newProductPrice) {
      toast.error("Product name and price are required");
      return;
    }
    const approvalFields = await getApprovalFields();
    const { error } = await supabase!.from("products").insert([
      {
        merchant_id: merchantId,
        name: newProductName,
        price: Number(newProductPrice),
        ...approvalFields,
      },
    ]);
    if (error) toast.error("Failed to add product");
    else {
      toast.success(
        role === "guest"
          ? "Product added — awaiting Admin & Warehouse approval"
          : `Product added — awaiting ${role === "admin" ? "Warehouse" : "Admin"} approval`,
      );
      setNewProductName("");
      setNewProductPrice("");
      fetchProducts(merchantId);
    }
  };

  const handleUpdateProduct = async (productId: string, merchantId: string) => {
    if (!editProductName || !editProductPrice) return;
    const { error } = await supabase!
      .from("products")
      .update({ name: editProductName, price: Number(editProductPrice) })
      .eq("id", productId);
    if (error) toast.error("Failed to update product");
    else {
      toast.success("Product updated");
      setEditingProductId(null);
      fetchProducts(merchantId);
    }
  };

  const handleDeleteProduct = async (productId: string, merchantId: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase!
      .from("products")
      .delete()
      .eq("id", productId);
    if (error) toast.error("Failed to delete product");
    else {
      toast.success("Product deleted");
      fetchProducts(merchantId);
    }
  };

  const handleUpdateMerchant = async () => {
    if (!editingMerchantId || !editMerchantName.trim()) return;
    const { error } = await supabase!
      .from("merchants")
      .update({ name: editMerchantName.trim() })
      .eq("id", editingMerchantId);
    if (error) toast.error("Failed to update merchant");
    else {
      toast.success("Merchant updated");
      setEditingMerchantId(null);
      fetchMerchants();
    }
  };

  const handleDeleteMerchant = async (merchantId: string) => {
    if (!confirm("Delete this merchant? This cannot be undone.")) return;
    const { error } = await supabase!
      .from("merchants")
      .delete()
      .eq("id", merchantId);
    if (error) toast.error("Failed to delete merchant");
    else {
      toast.success("Merchant deleted");
      fetchMerchants();
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === "approved") {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Approved
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Merchants & Products
          </h1>
          <p className="text-slate-500 mt-1">
            Manage merchants and their product catalogues.
          </p>
        </div>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Store className="h-5 w-5 text-slate-500" />
          Add New Merchant
        </h2>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Merchant name..."
            value={newMerchant}
            onChange={(e) => setNewMerchant(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleAddMerchant} className="gap-2">
            <Plus className="h-4 w-4" /> Add Merchant
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {/* Sticky Search & Filter bar */}
        <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200/70 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-slate-900">All Merchants</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  id="merchant-search"
                  placeholder="Search merchants…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-8 w-56"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
                {(["all", "approved", "pending"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                      statusFilter === f
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {f === "all"
                      ? "All"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          </Card>
        ) : merchants.length === 0 ? (
          <Card className="p-12 text-center text-slate-500">
            No merchants added yet.
          </Card>
        ) : (
          (() => {
            const filtered = merchants.filter((m) => {
              const matchesSearch = m.name
                .toLowerCase()
                .includes(searchQuery.toLowerCase().trim());
              const matchesStatus =
                statusFilter === "all" ||
                (m.approval_status || "approved") === statusFilter;
              return matchesSearch && matchesStatus;
            });

            if (filtered.length === 0) {
              return (
                <Card className="p-12 text-center">
                  <Search className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                  <p className="text-slate-500">
                    No merchants match your search.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                    className="mt-2 text-xs text-primary underline"
                  >
                    Clear filters
                  </button>
                </Card>
              );
            }

            return filtered.map((merchant) => (
              <Card key={merchant.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleToggleMerchant(merchant.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    {editingMerchantId === merchant.id ? (
                      <div
                        className="flex items-center gap-2 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          autoFocus
                          value={editMerchantName}
                          onChange={(e) => setEditMerchantName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateMerchant();
                            if (e.key === "Escape") setEditingMerchantId(null);
                          }}
                          className="h-8 max-w-xs text-sm"
                        />
                        <Button size="sm" onClick={handleUpdateMerchant}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMerchantId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {merchant.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge
                            status={merchant.approval_status || "approved"}
                          />
                          {/* Product count badge */}
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <Package className="h-3 w-3" />
                            {productCounts[merchant.id] ?? "—"} product
                            {(productCounts[merchant.id] ?? 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(role === "admin" || role === "warehouse") &&
                      editingMerchantId !== merchant.id && (
                        <>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMerchantId(merchant.id);
                              setEditMerchantName(merchant.name);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMerchant(merchant.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      )}
                    {expandedMerchant === merchant.id ? (
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </div>

                {expandedMerchant === merchant.id && (
                  <div className="p-4 border-t border-slate-100 bg-white">
                    <div className="mb-6 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                        <Package className="h-4 w-4" /> Add Product to{" "}
                        {merchant.name}
                      </h4>
                      <div className="flex items-center gap-3">
                        <Input
                          placeholder="Product Name"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          className="max-w-50"
                        />
                        <Input
                          type="number"
                          placeholder="Price (₦)"
                          value={newProductPrice}
                          onChange={(e) => setNewProductPrice(e.target.value)}
                          className="max-w-30"
                        />
                        <Button
                          onClick={() => handleAddProduct(merchant.id)}
                          size="sm"
                        >
                          Add Product
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {/* Product catalogue header + search/filter */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-700">
                          Products Catalogue
                        </h4>
                        {products[merchant.id] &&
                          products[merchant.id].length > 0 && (
                            <div className="flex items-center gap-2">
                              {/* Product search */}
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                <Input
                                  placeholder="Search products…"
                                  value={productSearches[merchant.id] || ""}
                                  onChange={(e) =>
                                    setProductSearches((prev) => ({
                                      ...prev,
                                      [merchant.id]: e.target.value,
                                    }))
                                  }
                                  className="pl-8 pr-7 h-7 text-xs w-44"
                                />
                                {productSearches[merchant.id] && (
                                  <button
                                    onClick={() =>
                                      setProductSearches((prev) => ({
                                        ...prev,
                                        [merchant.id]: "",
                                      }))
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    aria-label="Clear product search"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                              {/* Product status filter */}
                              <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
                                {(["all", "approved", "pending"] as const).map(
                                  (f) => (
                                    <button
                                      key={f}
                                      onClick={() =>
                                        setProductStatusFilters((prev) => ({
                                          ...prev,
                                          [merchant.id]: f,
                                        }))
                                      }
                                      className={`px-2 py-0.5 text-[10px] font-semibold rounded capitalize transition-colors ${
                                        (productStatusFilters[merchant.id] ||
                                          "all") === f
                                          ? "bg-white text-slate-900 shadow-sm"
                                          : "text-slate-500 hover:text-slate-700"
                                      }`}
                                    >
                                      {f === "all"
                                        ? "All"
                                        : f.charAt(0).toUpperCase() +
                                          f.slice(1)}
                                    </button>
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                      </div>

                      {!products[merchant.id] ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : products[merchant.id].length === 0 ? (
                        <p className="text-sm text-slate-500 italic">
                          No products added for this merchant.
                        </p>
                      ) : (
                        (() => {
                          const pSearch = (productSearches[merchant.id] || "")
                            .toLowerCase()
                            .trim();
                          const pStatus =
                            productStatusFilters[merchant.id] || "all";
                          const filteredProducts = products[merchant.id].filter(
                            (p) => {
                              const matchesName = p.name
                                .toLowerCase()
                                .includes(pSearch);
                              const matchesStatus =
                                pStatus === "all" ||
                                (p.approval_status || "approved") === pStatus;
                              return matchesName && matchesStatus;
                            },
                          );

                          if (filteredProducts.length === 0) {
                            return (
                              <div className="rounded-xl border border-dashed p-6 text-center">
                                <p className="text-sm text-slate-500">
                                  No products match your filter.
                                </p>
                                <button
                                  onClick={() => {
                                    setProductSearches((prev) => ({
                                      ...prev,
                                      [merchant.id]: "",
                                    }));
                                    setProductStatusFilters((prev) => ({
                                      ...prev,
                                      [merchant.id]: "all",
                                    }));
                                  }}
                                  className="mt-1 text-xs text-primary underline"
                                >
                                  Clear filters
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {filteredProducts.map((product) => (
                                <div
                                  key={product.id}
                                  className="border rounded-xl p-3 bg-slate-50/50"
                                >
                                  {editingProductId === product.id ? (
                                    <div className="space-y-2">
                                      <Input
                                        size={1}
                                        value={editProductName}
                                        onChange={(e) =>
                                          setEditProductName(e.target.value)
                                        }
                                        className="h-8 text-sm"
                                      />
                                      <Input
                                        size={1}
                                        type="number"
                                        value={editProductPrice}
                                        onChange={(e) =>
                                          setEditProductPrice(e.target.value)
                                        }
                                        className="h-8 text-sm"
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleUpdateProduct(
                                              product.id,
                                              merchant.id,
                                            )
                                          }
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() =>
                                            setEditingProductId(null)
                                          }
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <p className="font-semibold text-sm">
                                          {product.name}
                                        </p>
                                        <p className="text-xs text-primary font-mono font-medium">
                                          ₦
                                          {Number(
                                            product.price,
                                          ).toLocaleString()}
                                        </p>
                                        <div className="mt-1">
                                          <StatusBadge
                                            status={
                                              product.approval_status ||
                                              "approved"
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="icon-sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setEditingProductId(product.id);
                                            setEditProductName(product.name);
                                            setEditProductPrice(product.price);
                                          }}
                                        >
                                          <Edit2 className="h-3 w-3 text-slate-500" />
                                        </Button>
                                        <Button
                                          size="icon-sm"
                                          variant="ghost"
                                          onClick={() =>
                                            handleDeleteProduct(
                                              product.id,
                                              merchant.id,
                                            )
                                          }
                                        >
                                          <Trash2 className="h-3 w-3 text-red-500" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ));
          })()
        )}
      </div>
    </div>
  );
}
