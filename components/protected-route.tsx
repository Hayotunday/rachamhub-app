"use client";

import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallback?: React.ReactNode;
}

/**
 * ProtectedRoute wrapper for client-side route protection
 * Redirects to login if not authenticated, or to dashboard if role is not allowed
 */
export default function ProtectedRoute({
  children,
  requiredRoles,
  fallback,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Not authenticated
    if (!user) {
      router.replace("/login");
      return;
    }

    // Check role-based access
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) {
        // Redirect to role-specific dashboard
        router.replace(`/dashboard/${user.role}`);
      }
    }
  }, [user, loading, requiredRoles, router]);

  // Show loading state
  if (loading) {
    return (
      fallback || (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="text-center">
            <Spinner className="mx-auto mb-4 h-8 w-8" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      )
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Check role access
  if (
    requiredRoles &&
    requiredRoles.length > 0 &&
    !requiredRoles.includes(user.role)
  ) {
    return null;
  }

  return <>{children}</>;
}
