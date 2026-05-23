'use client';

import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { Package, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function FOMDashboard() {
  const { user } = useAuth();

  // Extract FOM level from role (fom1, fom2, fom3)
  const fomLevel = user?.role.toUpperCase() || 'FOM';

  const stats = [
    {
      title: 'Assigned Orders',
      value: '18',
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'In Progress',
      value: '7',
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Pending Approval',
      value: '4',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Completed Today',
      value: '12',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {fomLevel} Fulfillment Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage order fulfillment operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">FOM Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition">
            <h3 className="font-medium text-foreground">View My Orders</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Check assigned orders and their status
            </p>
          </div>
          <div className="p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition">
            <h3 className="font-medium text-foreground">Update Status</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Mark orders as in progress or completed
            </p>
          </div>
          <div className="p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition">
            <h3 className="font-medium text-foreground">Generate Reports</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Export fulfillment metrics and statistics
            </p>
          </div>
          <div className="p-4 border border-border rounded-lg hover:bg-accent/50 cursor-pointer transition">
            <h3 className="font-medium text-foreground">Escalations</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Handle orders requiring special attention
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
