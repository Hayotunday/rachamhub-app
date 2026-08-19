"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import OrderSearchFilter from "@/components/order-search-filter";
import {
  Plus,
  Trash2,
  Building2,
  Settings2,
  Truck,
  MapPin,
  Edit2,
  Check,
  X,
  Trash2 as DeleteIcon,
  ChevronDown,
  ChevronRight,
  Package,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [products, setProducts] = useState<Record<string, any[]>>({});
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductPrice, setEditProductPrice] = useState("");
  const [newMerchant, setNewMerchant] = useState("");
  const [newRider, setNewRider] = useState("");
  const [newRiderPhone, setNewRiderPhone] = useState("");
  const [newRiderType, setNewRiderType] = useState("external");
  const [newLandmark, setNewLandmark] = useState("");
  const [newLandmarkPrice, setNewLandmarkPrice] = useState("");
  const [settings, setSettings] = useState({
    order_prefix: "RCH-",
    session_timeout: "60",
    fom_names: "FOM1,FOM2,FOM3",
  });

  // Editing states
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(
    null,
  );
  const [editMerchantName, setEditMerchantName] = useState("");

  const [editingRiderId, setEditingRiderId] = useState<string | null>(null);
  const [editRiderName, setEditRiderName] = useState("");
  const [editRiderPhone, setEditRiderPhone] = useState("");
  const [editRiderType, setEditRiderType] = useState("external");

  const [editingLandmarkId, setEditingLandmarkId] = useState<string | null>(
    null,
  );
  const [editLandmarkName, setEditLandmarkName] = useState("");
  const [editLandmarkPrice, setEditLandmarkPrice] = useState("");

  const [merchantSearch, setMerchantSearch] = useState("");
  const [riderSearch, setRiderSearch] = useState("");
  const [landmarkSearch, setLandmarkSearch] = useState("");

  const filteredMerchants = useMemo(
    () =>
      merchants.filter((m) =>
        m.name.toLowerCase().includes(merchantSearch.toLowerCase()),
      ),
    [merchants, merchantSearch],
  );

  const filteredRiders = useMemo(
    () =>
      riders.filter(
        (r) =>
          r.name.toLowerCase().includes(riderSearch.toLowerCase()) ||
          r.phone.toLowerCase().includes(riderSearch.toLowerCase()),
      ),
    [riders, riderSearch],
  );

  const filteredLandmarks = useMemo(
    () =>
      landmarks.filter((l) =>
        l.name.toLowerCase().includes(landmarkSearch.toLowerCase()),
      ),
    [landmarks, landmarkSearch],
  );

  const fetchMerchants = async () => {
    const { data } = await supabase!
      .from("merchants")
      .select("id, name, is_active")
      .order("name");
    if (data) setMerchants(data);
  };

  const fetchProducts = async (merchantId: string) => {
    const { data } = await supabase!
      .from("products")
      .select("id, name, price, merchant_id")
      .eq("merchant_id", merchantId)
      .order("name");
    if (data) {
      setProducts((prev) => ({ ...prev, [merchantId]: data }));
    }
  };

  const handleToggleMerchant = (merchantId: string) => {
    if (expandedMerchant === merchantId) {
      setExpandedMerchant(null);
    } else {
      setExpandedMerchant(merchantId);
      fetchProducts(merchantId);
    }
  };

  const handleAddProduct = async (merchantId: string) => {
    if (!newProductName || !newProductPrice) {
      toast.error("Product name and price are required");
      return;
    }
    const { error } = await supabase!.from("products").insert([
      {
        merchant_id: merchantId,
        name: newProductName,
        price: Number(newProductPrice),
      },
    ]);
    if (error) toast.error("Failed to add product");
    else {
      toast.success("Product added");
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

  const fetchRiders = async () => {
    const { data } = await supabase!.from("riders").select("id, name, phone, rider_type, is_active").order("name");
    if (data) setRiders(data);
  };

  const fetchLandmarks = async () => {
    const { data } = await supabase!
      .from("landmarks")
      .select("id, name, price, is_active")
      .order("name");
    if (data) setLandmarks(data);
  };

  useEffect(() => {
    fetchMerchants();
    fetchRiders();
    fetchLandmarks();
  }, []);

  const handleAddMerchant = async () => {
    if (!newMerchant) return;
    const { error } = await supabase!
      .from("merchants")
      .insert([{ name: newMerchant }]);
    if (error) toast.error("Failed to add merchant");
    else {
      toast.success("Merchant added");
      setNewMerchant("");
      fetchMerchants();
    }
  };

  const handleDeactivateMerchant = async (id: string, current: boolean) => {
    const { error } = await supabase!
      .from("merchants")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) toast.error("Action failed");
    else fetchMerchants();
  };

  const handleUpdateMerchant = async (id: string) => {
    if (!editMerchantName) return;
    const { error } = await supabase!
      .from("merchants")
      .update({ name: editMerchantName })
      .eq("id", id);
    if (error) toast.error("Failed to update merchant");
    else {
      toast.success("Merchant updated");
      setEditingMerchantId(null);
      fetchMerchants();
    }
  };

  const handleDeleteMerchant = async (id: string) => {
    if (!confirm("Are you sure you want to delete this merchant permanently?"))
      return;
    const { error } = await supabase!.from("merchants").delete().eq("id", id);
    if (error) toast.error("Failed to delete merchant");
    else {
      toast.success("Merchant deleted");
      fetchMerchants();
    }
  };

  const handleAddRider = async () => {
    if (!newRider || !newRiderPhone) {
      toast.error("Please fill in all fields");
      return;
    }
    const { error } = await supabase!
      .from("riders")
      .insert([{ name: newRider, phone: newRiderPhone, rider_type: newRiderType }]);
    if (error) toast.error("Failed to add rider");
    else {
      toast.success("Rider added");
      setNewRider("");
      setNewRiderPhone("");
      fetchRiders();
    }
  };

  const handleDeactivateRider = async (id: string, current: boolean) => {
    const { error } = await supabase!
      .from("riders")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) toast.error("Action failed");
    else fetchRiders();
  };

  const handleUpdateRider = async (id: string) => {
    if (!editRiderName || !editRiderPhone) return;
    const { error } = await supabase!
      .from("riders")
      .update({ name: editRiderName, phone: editRiderPhone, rider_type: editRiderType })
      .eq("id", id);
    if (error) toast.error("Failed to update rider");
    else {
      toast.success("Rider updated");
      setEditingRiderId(null);
      fetchRiders();
    }
  };

  const handleDeleteRider = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rider permanently?"))
      return;
    const { error } = await supabase!.from("riders").delete().eq("id", id);
    if (error) toast.error("Failed to delete rider");
    else {
      toast.success("Rider deleted");
      fetchRiders();
    }
  };

  const handleAddLandmark = async () => {
    if (!newLandmark || !newLandmarkPrice) {
      toast.error("Please fill in all fields");
      return;
    }
    const { error } = await supabase!
      .from("landmarks")
      .insert([{ name: newLandmark, price: Number(newLandmarkPrice) }]);
    if (error) toast.error("Failed to add landmark");
    else {
      toast.success("Landmark added");
      setNewLandmark("");
      setNewLandmarkPrice("");
      fetchLandmarks();
    }
  };

  const handleDeactivateLandmark = async (id: string, current: boolean) => {
    const { error } = await supabase!
      .from("landmarks")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) toast.error("Action failed");
    else fetchLandmarks();
  };

  const handleUpdateLandmark = async (id: string) => {
    if (!editLandmarkName || !editLandmarkPrice) return;
    const { error } = await supabase!
      .from("landmarks")
      .update({ name: editLandmarkName, price: Number(editLandmarkPrice) })
      .eq("id", id);
    if (error) toast.error("Failed to update landmark");
    else {
      toast.success("Landmark updated");
      setEditingLandmarkId(null);
      fetchLandmarks();
    }
  };

  const handleDeleteLandmark = async (id: string) => {
    if (!confirm("Are you sure you want to delete this landmark permanently?"))
      return;
    const { error } = await supabase!.from("landmarks").delete().eq("id", id);
    if (error) toast.error("Failed to delete landmark");
    else {
      toast.success("Landmark deleted");
      fetchLandmarks();
    }
  };

  const saveSettings = () => {
    (async () => {
      try {
        const payload = [
          { key: "order_prefix", value: settings.order_prefix },
          { key: "session_timeout", value: String(settings.session_timeout) },
          { key: "fom_names", value: settings.fom_names },
        ];
        const { error } = await supabase!
          .from("settings")
          .upsert(payload, { onConflict: "key" });
        if (error) throw error;
        toast.success("System settings saved");
      } catch (err) {
        toast.error("Failed to save settings");
      }
    })();
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">
          Manage global configurations, merchants, riders, and landmarks.
        </p>
      </div>

      <Tabs defaultValue="riders" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="riders" className="gap-2">
            <Truck className="h-4 w-4" /> Riders
          </TabsTrigger>
          <TabsTrigger value="landmarks" className="gap-2">
            <MapPin className="h-4 w-4" /> Landmarks
          </TabsTrigger>
          {/* <TabsTrigger value="config" className="gap-2">
            <Settings2 className="h-4 w-4" /> System Config
          </TabsTrigger> */}
        </TabsList>

        {/* Riders Management */}
        <TabsContent value="riders" className="space-y-6">
          <OrderSearchFilter
            searchTerm={riderSearch}
            onSearchTermChange={setRiderSearch}
            placeholder="Filter riders by name or phone..."
            title="Find Rider"
          />
          <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-border flex-wrap">
            <Input
              placeholder="Rider Name..."
              value={newRider}
              onChange={(e) => setNewRider(e.target.value)}
              className="max-w-xs"
            />
            <Input
              placeholder="Phone Number..."
              value={newRiderPhone}
              onChange={(e) => setNewRiderPhone(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={newRiderType}
              onChange={(e) => setNewRiderType(e.target.value)}
              className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="external">External</option>
              <option value="in-house">In-House</option>
            </select>
            <Button onClick={handleAddRider} className="gap-2">
              <Plus className="h-4 w-4" /> Add Rider
            </Button>
          </div>

          <div className="grid gap-3">
            {filteredRiders.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-4 border rounded-xl bg-white hover:bg-muted/5 transition-colors"
              >
                <div className="flex gap-8 flex-1 items-center">
                  {editingRiderId === r.id ? (
                    <>
                      <Input
                        value={editRiderName}
                        onChange={(e) => setEditRiderName(e.target.value)}
                        className="h-8 max-w-xs"
                      />
                      <Input
                        value={editRiderPhone}
                        onChange={(e) => setEditRiderPhone(e.target.value)}
                        className="h-8 max-w-xs"
                      />
                      <select
                        value={editRiderType}
                        onChange={(e) => setEditRiderType(e.target.value)}
                        className="flex h-8 w-32 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="external">External</option>
                        <option value="in-house">In-House</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <p
                        className={`font-semibold min-w-32 ${!r.is_active ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {r.name}
                      </p>
                      <p className="text-sm text-muted-foreground w-32">{r.phone}</p>
                      <span className="px-2 py-0.5 rounded-full bg-muted/50 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        {r.rider_type || "external"}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingRiderId === r.id ? (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleUpdateRider(r.id)}
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditingRiderId(null)}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingRiderId(r.id);
                          setEditRiderName(r.name);
                          setEditRiderPhone(r.phone);
                          setEditRiderType(r.rider_type || "external");
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          r.is_active
                            ? "text-amber-600 h-8"
                            : "text-emerald-600 h-8"
                        }
                        onClick={() => handleDeactivateRider(r.id, r.is_active)}
                      >
                        {r.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDeleteRider(r.id)}
                      >
                        <DeleteIcon className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Landmarks Management */}
        <TabsContent value="landmarks" className="space-y-6">
          <OrderSearchFilter
            searchTerm={landmarkSearch}
            onSearchTermChange={setLandmarkSearch}
            placeholder="Filter landmarks by name..."
            title="Find Landmark"
          />
          <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-border">
            <Input
              placeholder="Landmark Name..."
              value={newLandmark}
              onChange={(e) => setNewLandmark(e.target.value)}
              className="max-w-xs"
            />
            <Input
              type="number"
              placeholder="Price (₦)..."
              value={newLandmarkPrice}
              onChange={(e) => setNewLandmarkPrice(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleAddLandmark} className="gap-2">
              <Plus className="h-4 w-4" /> Add Landmark
            </Button>
          </div>

          <div className="grid gap-3">
            {filteredLandmarks.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between p-4 border rounded-xl bg-white hover:bg-muted/5 transition-colors"
              >
                <div className="flex gap-8 flex-1">
                  {editingLandmarkId === l.id ? (
                    <>
                      <Input
                        value={editLandmarkName}
                        onChange={(e) => setEditLandmarkName(e.target.value)}
                        className="h-8 max-w-xs"
                      />
                      <Input
                        type="number"
                        value={editLandmarkPrice}
                        onChange={(e) => setEditLandmarkPrice(e.target.value)}
                        className="h-8 max-w-xs"
                      />
                    </>
                  ) : (
                    <>
                      <p
                        className={`font-semibold min-w-32 ${!l.is_active ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {l.name}
                      </p>
                      <p className="text-sm font-mono text-emerald-600">
                        ₦{Number(l.price).toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingLandmarkId === l.id ? (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleUpdateLandmark(l.id)}
                      >
                        <Check className="h-4 w-4 text-emerald-500" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditingLandmarkId(null)}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingLandmarkId(l.id);
                          setEditLandmarkName(l.name);
                          setEditLandmarkPrice(String(l.price));
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          l.is_active
                            ? "text-amber-600 h-8"
                            : "text-emerald-600 h-8"
                        }
                        onClick={() =>
                          handleDeactivateLandmark(l.id, l.is_active)
                        }
                      >
                        {l.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDeleteLandmark(l.id)}
                      >
                        <DeleteIcon className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* General Config */}
        <TabsContent value="config">
          <Card className="p-8 max-w-2xl border-border bg-white shadow-none rounded-xl">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-bold">Order ID Prefix</Label>
                <Input
                  value={settings.order_prefix}
                  onChange={(e) =>
                    setSettings({ ...settings, order_prefix: e.target.value })
                  }
                  placeholder="e.g. RCH-"
                />
                <p className="text-[10px] text-muted-foreground">
                  Applied to all new system orders.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">
                  Session Timeout (Minutes)
                </Label>
                <Input
                  type="number"
                  value={settings.session_timeout}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      session_timeout: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold">FOM Assignee Labels</Label>
                <Input
                  value={settings.fom_names}
                  onChange={(e) =>
                    setSettings({ ...settings, fom_names: e.target.value })
                  }
                  placeholder="FOM1,FOM2,FOM3"
                />
                <p className="text-[10px] text-muted-foreground">
                  Comma separated labels for role assignments.
                </p>
              </div>

              <Button className="w-full mt-4" onClick={saveSettings}>
                Save System Configuration
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
