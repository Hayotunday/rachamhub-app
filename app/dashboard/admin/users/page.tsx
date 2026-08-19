"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DataTable, { type DataTableColumn } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  UserPlus,
  Edit,
  ShieldAlert,
  Key,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<any>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [showDeletedUsers, setShowDeletedUsers] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    display_name: "",
    role: "fom",
    is_active: true,
  });

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase!
      .from("users")
      .select("id, email, display_name, role, is_active, is_deleted, created_at")
      .order("created_at", { ascending: false });

    if (error) toast.error("Error fetching users");
    else setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const columns: DataTableColumn[] = [
    {
      key: "display_name",
      label: "User",
      longText: true,
      render: (row) => (
        <>
          <div className="font-medium text-xs">{(row as any).display_name}</div>
          <div className="text-[10px] text-muted-foreground">
            {(row as any).email}
          </div>
        </>
      ),
      getSearchableText: (row) =>
        `${(row as any).display_name} ${(row as any).email}`,
    },
    {
      key: "role",
      label: "Role",
      render: (row) => (
        <Badge variant="outline" className="capitalize text-[10px]">
          {String((row as any).role).replace("_", " ")}
        </Badge>
      ),
      getSearchableText: (row) => String((row as any).role).replace("_", " "),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge
          variant={
            row.is_deleted
              ? "destructive"
              : row.is_active !== false
                ? "default"
                : "secondary"
          }
          className="text-[10px]"
        >
          {row.is_deleted
            ? "Deleted"
            : row.is_active !== false
              ? "Active"
              : "Inactive"}
        </Badge>
      ),
      getSearchableText: (row) =>
        row.is_deleted
          ? "Deleted"
          : row.is_active !== false
            ? "Active"
            : "Inactive",
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) =>
        new Date((row as any).created_at).toLocaleString([], {
          dateStyle: "short",
          timeStyle: "short",
        }),
      getSearchableText: (row) =>
        new Date((row as any).created_at).toLocaleString([], {
          dateStyle: "short",
          timeStyle: "short",
        }),
    },
  ];

  const handleOpenModal = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      setForm({
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        is_active: user.is_active ?? true,
      });
    } else {
      setEditingUser(null);
      setForm({ email: "", display_name: "", role: "fom", is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!form.email || !form.display_name) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        const { error } = await supabase!
          .from("users")
          .update({
            display_name: form.display_name,
            role: form.role,
            is_active: form.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingUser.id);
        if (error) throw error;
        toast.success("User updated successfully");
      } else {
        // Create a new auth user via the protected admin API
        const { data: sessionData } = await supabase!.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("Not authenticated");

        const res = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: form.email,
            displayName: form.display_name,
            role: form.role,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to create user");
        }
        toast.success("User created — temporary password emailed (or shipped)");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error("Action failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = (user: any) => {
    setPasswordTargetUser(user);
    setPasswordValue("");
    setPasswordModalOpen(true);
  };

  const submitNewPassword = async () => {
    if (!passwordValue || passwordValue.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    const doUpdate = async () => {
      const { data: sessionData } = await supabase!.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: passwordTargetUser.id,
          password: passwordValue,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to set password");
      return json;
    };

    try {
      await toast.promise(doUpdate(), {
        loading: "Updating password...",
        success: `Password updated for ${passwordTargetUser.email}`,
        error: "Error updating password",
      });
      setPasswordModalOpen(false);
      setPasswordTargetUser(null);
      setPasswordValue("");
      fetchUsers();
    } catch (e) {
      // already handled by toast
    }
  };

  const handleConfirmDelete = (user: any) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const { error } = await supabase!
        .from("users")
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq("id", userToDelete.id);

      if (error) throw error;

      toast.success(`User ${userToDelete.display_name} marked as deleted.`);
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers(); // Refresh the list
    } catch (err) {
      toast.error("Failed to delete user.");
      console.error("Error deleting user:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage roles, permissions, and account status.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
        <div className="space-y-0.5">
          <Label htmlFor="show-deleted" className="text-sm font-medium">
            Show Deleted Users
          </Label>
          <p className="text-xs text-muted-foreground">
            Toggle to view active or archived user accounts.
          </p>
        </div>
        <div className="flex items-center">
          <Switch
            id="show-deleted"
            checked={showDeletedUsers}
            onCheckedChange={setShowDeletedUsers}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : showDeletedUsers ? (
          <DataTable
            headers={columns}
            rows={users.filter((user) => user.is_deleted === true) as any}
            searchPlaceholder="Search users..."
          />
        ) : (
          <DataTable
            headers={columns}
            rows={users.filter((user) => user.is_deleted === false) as any}
            searchPlaceholder="Search users..."
            showActions={!showDeletedUsers}
            renderRowActions={(row) =>
              !row.is_deleted && (
                <div className="flex justify-end gap-2">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleResetPassword(row)}
                    title="Reset Password"
                  >
                    <Key className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleOpenModal(row)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleConfirmDelete(row)}
                    title="Delete User"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              )
            }
          />
        )}
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user details and permissions."
                : "Create a new user account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                disabled={!!editingUser}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="customer_service">Customer Service</option>
                <option value="warehouse">Warehouse</option>
                <option value="fom">Fleet Operator (FOM)</option>
                <option value="accounting">Accounting</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Account Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveUser} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingUser ? "Saving..." : "Creating..."}
                </>
              ) : editingUser ? (
                "Save Changes"
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set New Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordTargetUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={submitNewPassword}>Set Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark{" "}
              <span className="font-medium text-foreground">
                {userToDelete?.display_name} ({userToDelete?.email})
              </span>{" "}
              as deleted? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              <Trash2 className="mr-2 h-4 w-4" /> Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
