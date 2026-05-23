'use client';

import { Card } from '@/components/ui/card';

export default function FOMOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Orders</h1>
        <p className="text-muted-foreground mt-2">Manage assigned orders and fulfillment status</p>
      </div>

      <Card className="p-6">
        <p className="text-muted-foreground">Orders list coming soon...</p>
      </Card>
    </div>
  );
}
