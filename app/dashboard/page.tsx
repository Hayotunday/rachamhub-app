"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export const dynamic = "force-dynamic";

/**
 * Dashboard router: Redirects to role-specific dashboard
 */
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<string>("Checking session...");

  useEffect(() => {
    if (loading) {
      setStatus("Checking session...");
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    // Route to role-specific dashboard
    router.replace(`/dashboard/${user.role}`);
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center w-full max-w-md">
        <Card className="p-6">
          <Spinner className="mx-auto mb-4 h-8 w-8" />
          <h3 className="text-lg font-semibold">Preparing your dashboard</h3>
          <p className="text-sm text-muted-foreground mt-2">{status}</p>
          <p className="text-xs text-muted-foreground mt-4">
            If this takes longer than 30 seconds, try refreshing the page or
            sign out and sign in again.
          </p>
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
