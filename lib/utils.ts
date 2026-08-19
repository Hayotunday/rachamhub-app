import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Order } from "@/lib/types";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import supabase from "./supabase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateDisplay(input: Date) {
  return new Date(input).toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export const formatCurrency = (value: number) => {
  const num = Number(value || 0);
  const absNum = Math.abs(num);

  if (absNum >= 1e9) {
    const formatted = parseFloat((num / 1e9).toFixed(2));
    return `₦${formatted}B`;
  } else if (absNum >= 1e6) {
    const formatted = parseFloat((num / 1e6).toFixed(2));
    return `₦${formatted}M`;
  }

  return `₦${num.toLocaleString()}`;
};

const getOrders = async (startDate?: Date, endDate?: Date) => {
  let query = supabase!.from("orders").select("id, created_at, customer_name, phone_numbers, delivery_address, items, total_amount, merchant, warehouse_status, inventory_status, fom_assigned, fom_assigned_at, rider_name, payment_to_rider, rider_assigned_at, fom_delivery_status, landmark, payment_method, bank, quantity_delivered, amount_paid, payment_confirmed, payment_verified_at, payment_to_merchant, cc_comment, warehouse_comment, fom_comment, extracted_by");

  if (startDate) {
    query = query.gte("created_at", startDate.toISOString());
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query = query.lte("created_at", end.toISOString());
  }

  const { data, error: fetchError } = await query
    .order("created_at", { ascending: false })
    .limit(10000);

  const { data: landmarksData } = await supabase!.from("landmarks").select("name, price");

  return { data: data as Order[] | null, fetchError, landmarks: landmarksData || [] };
};

export const prepareExportData = (
  orders: Order[],
  fomUsers: any[] = [],
  ccUsers: any[] = [],
  landmarks: any[] = [],
) => {
  const headers = [
    "Order ID",
    "Created At",
    "Customer Name",
    "Phone Numbers",
    "Delivery Address",
    "Items",
    "Total Amount",
    "Merchant",
    "WH Status",
    "Inventory Status",
    "FOM Assigned",
    "FOM Assigned At",
    "Rider Name",
    "Rider Price",
    "Rider Assigned At",
    "FOM Status",
    "Landmark",
    "Landmark Price",
    "Payment Method",
    "Bank",
    "Quantity Delivered",
    "Amount Paid",
    "Payment Confirmed",
    "Payment Confirmed At",
    "Payment To Merchant",
    "CC Note",
    "WH Note",
    "FOM Note",
    "Entered By",
  ];

  const rows = orders.map((order) => {
    const fomUser = fomUsers.find((u) => u.id === (order as any).fom_assigned);
    const ccUser = ccUsers.find((u) => u.id === order.extracted_by);
    const riderPrice = Number((order as any).payment_to_rider || 0);
    const total = Number(order.total_amount || 0);
    const landmarkRecord = landmarks.find((l) => l.name === (order as any).landmark);
    const landmarkPrice = Number(landmarkRecord?.price || 0);

    return [
      `${order.id.split("-")[0]}`,
      formatDateDisplay(new Date(order.created_at)),
      order.customer_name || "",
      Array.isArray(order.phone_numbers) ? order.phone_numbers.join(", ") : "",
      order.delivery_address || "",
      order.items?.map((i) => `${i.quantity}x ${i.name}`).join("; ") || "",
      total.toFixed(2),
      order.merchant || "",
      (order as any).warehouse_status || "",
      order.inventory_status || "",
      fomUser?.display_name || "",
      formatDateDisplay(new Date(order.fom_assigned_at)),
      (order as any).rider_name || "",
      riderPrice.toFixed(2),
      formatDateDisplay(new Date(order.rider_assigned_at)),
      order.fom_delivery_status || "",
      (order as any).landmark || "",
      landmarkPrice.toFixed(2),
      (order as any).payment_method || "",
      (order as any).bank || "",
      (order as any).quantity_delivered || "",
      (order as any).amount_paid || "",
      (order as any).payment_confirmed ? "Yes" : "No",
      formatDateDisplay(new Date(order.payment_verified_at)),
      order.payment_to_merchant || "",
      (order as any).cc_comment || "",
      (order as any).warehouse_comment || "",
      (order as any).fom_comment || "",
      ccUser?.display_name || "",
    ];
  });

  return { headers, rows };
};

export const buildCsv = (
  orders: Order[],
  fomUsers: any[] = [],
  ccUsers: any[] = [],
  landmarks: any[] = [],
) => {
  const { headers, rows } = prepareExportData(orders, fomUsers, ccUsers, landmarks);
  const escapeValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

  return [headers, ...rows]
    .map((row) => row.map((value) => escapeValue(String(value))).join(","))
    .join("\n");
};

export const handleExport = async (
  fomUsers: any[] = [],
  ccUsers: any[] = [],
  type: "csv" | "xlsx" = "csv",
  startDate?: Date,
  endDate?: Date,
) => {
  const { data: orders, landmarks } = await getOrders(startDate, endDate);
  if (type === "xlsx") {
    const { headers, rows } = prepareExportData(orders!, fomUsers, ccUsers, landmarks);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    XLSX.writeFile(
      workbook,
      `rachamhub-orders-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    return;
  }

  const csv = buildCsv(orders!, fomUsers, ccUsers, landmarks);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rachamhub-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// export const printTicket = (order: Order) => {
//   const pdf = new jsPDF({
//     orientation: "portrait",
//     unit: "mm",
//     format: "a5",
//   });
//   const margin = 14;
//   const pageWidth = pdf.internal.pageSize.getWidth();
//   const ticketId = order.id.split("-")[0].toUpperCase();
//   let cursorY = 16;

//   pdf.setProperties({ title: `Order Ticket - ${ticketId}` });
//   pdf.setFont("helvetica", "bold");
//   pdf.setFontSize(15);
//   pdf.text("RACHAMHUB LIMITED TICKET", pageWidth / 2, cursorY, {
//     align: "center",
//   });
//   cursorY += 8;
//   pdf.setFont("helvetica", "italic");
//   pdf.setFontSize(11);
//   pdf.text("* Call before going *", pageWidth / 2, cursorY, {
//     align: "center",
//   });
//   cursorY += 10;

//   const addField = (label: string, value: string) => {
//     pdf.setFont("helvetica", "bold");
//     pdf.setFontSize(10);
//     pdf.text(`${label}:`, margin, cursorY);
//     const valueX = margin + pdf.getTextWidth(`${label}: `);
//     const lines = pdf.splitTextToSize(value, pageWidth - margin - valueX);
//     pdf.setFont("helvetica", "normal");
//     pdf.text(lines, valueX, cursorY);
//     cursorY += Math.max(6, lines.length * 5) + 1;
//   };

//   addField("Customer", order.customer_name || "-");
//   addField("Phone", order.phone_numbers?.join(", ") || "-");
//   addField("Address", order.delivery_address || "-");
//   addField("Order ID", `#${ticketId}`);
//   addField("Merchant", order.merchant || "-");

//   autoTable(pdf, {
//     startY: cursorY + 2,
//     head: [["Product Name", "Qty"]],
//     body: order.items?.map((item) => [item.name, String(item.quantity)]) || [],
//     margin: { left: margin, right: margin },
//     styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
//     headStyles: { fillColor: [0, 0, 0], textColor: 255 },
//     columnStyles: { 1: { halign: "center", cellWidth: 20 } },
//   });
//   const tableEndY = (pdf as jsPDF & {
//     lastAutoTable: { finalY: number };
//   }).lastAutoTable.finalY;
//   cursorY = tableEndY + 9;

//   pdf.setFont("helvetica", "bold");
//   pdf.setFontSize(11);
//   pdf.text(
//     `Total Amount: ₦${Number(order.total_amount || 0).toLocaleString()}`,
//     pageWidth - margin,
//     cursorY,
//     { align: "right" },
//   );
//   cursorY += 9;
//   addField("Comment", order.cc_comment || "-");

//   pdf.save(`rachamhub-order-ticket-${ticketId}.pdf`);
// };

export const printTicket = (order: Order) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const itemsHtml =
    order.items
      ?.map(
        (item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
    </tr>
  `,
      )
      .join("") || "";

  printWindow.document.write(`
    <html>
      <head>
        <title>Order Ticket - ${order.id.split("-")[0]}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 20px; line-height: 1.5; color: #111; font-weight: 700; }
          .ticket { border: 3px solid #000; padding: 20px; max-width: 500px; margin: auto; }
          h1 { text-align: center; margin-top: 0; font-size: 1.5rem; border-bottom: 3px solid #000; padding-bottom: 10px; font-weight: 900; }
          .call { text-align: center; font-size: 1.15rem; margin: 10px 0; font-style: italic; color: #111; font-weight: 900; }
          .field { margin-bottom: 10px; font-size: 1.05rem; font-weight: 800; }
          .label { font-weight: 900; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { border-bottom: 3px solid #000; text-align: left; padding: 8px; font-weight: 900; }
          td { font-weight: 800; }
          .total { margin-top: 20px; border-top: 3px solid #000; padding-top: 10px; font-size: 1.25rem; font-weight: 900; text-align: right; }
          .comment { margin-top: 20px; border-top: 3px solid #000; padding-top: 10px; font-size: 1.2rem; font-weight: 900; text-align: right; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <h1>RACHAMHUB LIMITED TICKET</h1>
          <h2 class="call">* Call before going *</h2>
          <div class="field"><span class="label">Customer:</span> ${order.customer_name}</div>
          <div class="field"><span class="label">Phone:</span> ${order.phone_numbers?.join(", ") || "-"}</div>
          <div class="field"><span class="label">Address:</span> ${order.delivery_address}</div>
          <div class="field"><span class="label">Order ID:</span> #${order.id.split("-")[0].toUpperCase()}</div>
          <div class="field"><span class="label">Merchant:</span> #${order.merchant}</div>
          
          <table>
            <thead>
              <tr><th>Product Name</th><th style="text-align:center">Qty</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div class="total">Total Amount: ₦${Number(order.total_amount).toLocaleString()}</div>
          <div class="comment">Comment: ${order.cc_comment || "-"}</div>
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
