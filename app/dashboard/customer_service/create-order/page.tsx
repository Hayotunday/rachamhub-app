import OrderExtractionForm from "@/components/order-extraction-form";

export default function CreateOrderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          AI Order Extraction
        </h1>
        <p className="text-muted-foreground mt-2">
          Paste order text or upload an image, and our AI will extract order
          details automatically
        </p>
      </div>

      <OrderExtractionForm />
    </div>
  );
}
