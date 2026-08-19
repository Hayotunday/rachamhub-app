"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type InquiryStatus = "open" | "in_progress" | "closed";

type CustomerInquiry = {
  id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<InquiryStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  closed: "Closed",
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<CustomerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInquiries = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase!
        .from("customer_inquiries")
        .select("id, customer_name, customer_email, subject, message, status, created_at")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setInquiries((data ?? []) as CustomerInquiry[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load inquiries.",
      );
    } finally {
      setLoading(false);
    }
  };

  const markResolved = async (inquiryId: string) => {
    setActionLoading(inquiryId);
    setError(null);

    try {
      const { error: updateError } = await supabase!
        .from("customer_inquiries")
        .update({ status: "closed" })
        .eq("id", inquiryId);

      if (updateError) {
        throw updateError;
      }

      await fetchInquiries();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update inquiry status.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchInquiries();
    const channel = supabase!
      .channel("customer-service-inquiries")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_inquiries" },
        () => fetchInquiries(),
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Customer Inquiries
        </h1>
        <p className="text-muted-foreground mt-2">
          Respond to customer questions and resolve open requests.
        </p>
      </div>

      {loading ? (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            Loading inquiries...
          </p>
        </Card>
      ) : error ? (
        <Card className="p-6 bg-destructive/10 text-destructive">{error}</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Subject
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {inquiries.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    No inquiries yet.
                  </td>
                </tr>
              ) : (
                inquiries.map((inquiry) => (
                  <tr key={inquiry.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">
                        {inquiry.customer_name}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {inquiry.customer_email}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">
                        {inquiry.subject}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {inquiry.message}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          inquiry.status === "closed" ? "secondary" : "outline"
                        }
                      >
                        {STATUS_LABELS[inquiry.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={
                          inquiry.status === "closed" ||
                          actionLoading === inquiry.id
                        }
                        onClick={() => markResolved(inquiry.id)}
                      >
                        {actionLoading === inquiry.id
                          ? "Saving..."
                          : inquiry.status === "closed"
                            ? "Resolved"
                            : "Mark Resolved"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
