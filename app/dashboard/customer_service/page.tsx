"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { AlertCircle, CheckCircle2, Clock, Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default function CustomerServiceDashboard() {
  const { user } = useAuth();

  const stats = [
    {
      title: "Active Orders",
      value: "24",
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Pending Review",
      value: "8",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Resolved Today",
      value: "12",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Alerts",
      value: "3",
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user?.displayName}
        </h1>
        <p className="text-muted-foreground mt-2">
          Here&apos;s an overview of today&apos;s activities
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/customer_service/create-order"
            className="p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition"
          >
            <h3 className="font-medium text-foreground">Create New Order</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manually create a new order for a customer
            </p>
          </Link>
          <Link
            href="/dashboard/customer_service/orders"
            className="p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition"
          >
            <h3 className="font-medium text-foreground">Order History</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Search and view historical orders
            </p>
          </Link>
        </div>
      </Card>
    </div>
  );
}
