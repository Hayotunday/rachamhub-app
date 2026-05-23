import Link from "next/link";
import { MapPinOff, ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="relative mb-8">
        <div className="absolute -inset-1 rounded-full bg-primary/20 blur-xl animate-pulse" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPinOff size={48} strokeWidth={1.5} />
        </div>
      </div>

      <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        Route Not Found
      </h1>

      <div className="mb-8 flex items-center gap-2 text-muted-foreground">
        <Package size={18} />
        <p className="text-lg">
          We couldn&apos;t find the delivery destination you&apos;re looking
          for.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          asChild
          variant="default"
          className="gap-2 bg-[#1B7A3E] hover:bg-[#1B7A3E]/90"
        >
          <Link href="/dashboard">
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/customer_service/inquiries">
            Report a Problem
          </Link>
        </Button>
      </div>

      <p className="mt-12 text-sm text-muted-foreground/50 uppercase tracking-widest font-mono">
        Error 404 • RachamHub Logistics
      </p>
    </div>
  );
}
