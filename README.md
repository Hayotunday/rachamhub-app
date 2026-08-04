# RachamHub - Lagos Logistics Management System

A modern, production-ready Next.js 15 application for managing logistics operations in Lagos, Nigeria. It provides role-based dashboards, AI-powered order extraction, and real-time updates using Supabase (PostgreSQL + Realtime).

## 🚀 Overview

RachamHub is a comprehensive logistics management system designed specifically for Nigerian logistics companies. It features:

- **Role-Based Access Control**: 6 distinct roles with customized real-time dashboards.
- **AI-Powered Order Extraction**: Google Gemini AI extracts order details from raw text, automatically mapping items, quantities, and customer details.
- **Real-Time Data**: Supabase Realtime (PostgreSQL logical replication) ensures that all dashboards are instantly updated when order statuses change.
- **Advanced Data Management**: Server-side filtering, exact database count pagination, and date-range filtering for large datasets.
- **Responsive Design**: Mobile-first design optimized for all devices with a Lagos-inspired theme (Green, Yellow, and Black).
- **Authentication**: Secure email/password authentication using Supabase Auth.

## 📋 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Postgres, Realtime)
- **AI**: Google Gemini (AI Order Extraction)

## 🎯 Role-Based Dashboards

Six specialized dashboard views tailored to the workflow of different teams:

| Role                 | Key Features                                          |
| -------------------- | ------------------------------------------------- |
| **Customer Service** | Order creation, AI extraction, customer inquiries, order edits |
| **Warehouse**        | Queue management, out-of-stock handling, inventory/stock tracking |
| **FOM**              | (Field Operations Manager) Order fulfillment, dispatch, route planning |
| **Accounting**       | Payment confirmations, invoices, rider payments, reconciliation |
| **Admin**            | Global analytics, user management, system settings |
| **Merchant**         | External merchant portal for viewing stock, approvals, and their specific orders |

## 📁 Project Structure

```text
rachamhub/
├── app/
│   ├── api/                     # Backend API Routes (Gemini, Admin, etc.)
│   ├── login/                   # User Login pages
│   ├── merchant/                # Merchant portal pages
│   └── dashboard/               # Core application dashboards
│       ├── customer_service/    
│       ├── warehouse/           
│       ├── fom/                 
│       ├── accounting/          
│       └── admin/               
├── components/                  # Reusable UI components (shadcn/ui, Data Tables, etc.)
├── hooks/                       # Custom React hooks (Supabase Realtime, etc.)
├── lib/                         # Utilities and Supabase client config
└── sql/                         # Database initialization scripts
```

## 🛠️ Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy the `.env.local.example` file and configure your keys:

```bash
cp .env.local.example .env.local
```

Add your keys to `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
```

### 3. Database Setup

Run `sql/supabase-init.sql` in the Supabase SQL editor to create the `users`, `orders`, `merchants`, `landmarks`, and `riders` tables, setup Row Level Security (RLS) policies, triggers, and insert demo data. 
*Note: After creating Auth users in Supabase, ensure profile rows in `public.users` match the Supabase Auth user `id` values.*

### 4. Run the Development Server

```bash
pnpm dev
```

## 🤝 Support

If you encounter issues, verify that:
- Your `NEXT_PUBLIC_SUPABASE_*` environment variables are correctly set.
- Supabase Auth users exist for the demo emails.
- The `id` field in the `public.users` table perfectly matches the Supabase Auth user IDs.

---

**Version**: 1.1.0
**Last Updated**: 2026-08-04
