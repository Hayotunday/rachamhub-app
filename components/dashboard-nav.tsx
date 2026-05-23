"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  Package,
  Warehouse,
  DollarSign,
  Users,
  Settings,
  MessageSquare,
  Zap,
  Home,
} from "lucide-react";
import { ROLE_LABELS } from "@/lib/types";
import { useState } from "react";

/**
 * Role-based sidebar navigation
 * Shows different menu items based on user role
 */
export default function DashboardNav() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("[Dashboard Nav] Sign out error:", error);
      setIsSigningOut(false);
    }
  };

  // Define role-specific menu items
  const getMenuItems = () => {
    const baseItems = [
      {
        label: "Orders",
        href: `/dashboard/${user.role}/orders`,
        icon: Package,
      },
    ];

    const roleMenus: Record<string, typeof baseItems> = {
      customer_service: [
        {
          label: "Home",
          href: `/dashboard/${user.role}/`,
          icon: Home,
        },
        {
          label: "Create Order",
          href: `/dashboard/${user.role}/create-order`,
          icon: Zap,
        },
        {
          label: "Orders",
          href: `/dashboard/${user.role}/orders`,
          icon: Package,
        },
        // {
        //   label: "Customer Inquiries",
        //   href: `/dashboard/${user.role}/inquiries`,
        //   icon: MessageSquare,
        // },
      ],
      warehouse: [
        {
          label: "Inventory",
          href: `/dashboard/${user.role}/inventory`,
          icon: Warehouse,
        },
        {
          label: "Orders",
          href: `/dashboard/${user.role}/orders`,
          icon: Package,
        },
      ],
      accounting: [
        {
          label: "Invoices",
          href: `/dashboard/${user.role}/invoices`,
          icon: DollarSign,
        },
        {
          label: "Payments",
          href: `/dashboard/${user.role}/payments`,
          icon: DollarSign,
        },
      ],
      admin: [
        {
          label: "Dashboard",
          href: `/dashboard/${user.role}/overview`,
          icon: Package,
        },
        {
          label: "Users",
          href: `/dashboard/${user.role}/users`,
          icon: Users,
        },
        {
          label: "Settings",
          href: `/dashboard/${user.role}/settings`,
          icon: Settings,
        },
      ],
    };

    // If role has a specific menu, return it, otherwise fall back to baseItems
    return roleMenus[user.role] || baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo Section */}
      <div className="border-b border-sidebar-border p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-lg">
              R
            </span>
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-sidebar-foreground">RachamHub</h2>
            <p className="text-xs text-sidebar-foreground/60">Logistics</p>
          </div>
        </Link>
      </div>

      {/* User Info Section */}
      <div className="border-b border-sidebar-border p-4 bg-sidebar-primary/10">
        <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wide">
          {ROLE_LABELS[user.role]}
        </p>
        <p className="text-sm font-medium text-sidebar-foreground truncate">
          {user.displayName}
        </p>
        <p className="text-xs text-sidebar-foreground/60 truncate">
          {user.email}
        </p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Sign Out Section */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-3 border-sidebar-border"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut className="h-5 w-5" />
          <span>{isSigningOut ? "Signing Out..." : "Sign Out"}</span>
        </Button>
      </div>
    </aside>
  );
}
