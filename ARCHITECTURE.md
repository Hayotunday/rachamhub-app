# RachamHub Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     RachamHub Application                       │
│                     (Next.js 15 App Router)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 │            │            │
            ┌────▼─────┐ ┌────▼─────┐ ┌───▼──────┐
            │  Firebase│ │  Google  │ │ External │
            │   Auth   │ │  Gemini  │ │   APIs   │
            └──────────┘ └──────────┘ └──────────┘
                 │            │
            ┌────▼─────┐ ┌────▼──────┐
            │Firestore │ │ AI Model  │
            │(Database)│ │           │
            └──────────┘ └───────────┘
```

## Application Layers

### 1. Presentation Layer (Frontend)

```
┌─────────────────────────────────────────────────────────────┐
│                    Pages & Components                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Login Page                              │   │
│  │  • Email/Password form                               │   │
│  │  • Firebase authentication                           │   │
│  │  • Error handling                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                  │
│                    Authenticated?                           │
│                     /  ✓ \ ✗                                |
│              Dashboard    Login                             │
│                          │                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │             Dashboard Layout                         │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ Sidebar (Role-Based Navigation)                │  │   │
│  │  │ • Customer Service: Orders, Extract, Inquiries │  │   │
│  │  │ • Warehouse: Inventory, Orders                 │  │   │
│  │  │ • FOM1/2/3: Orders, Status                     │  │   │
│  │  │ • Accounting: Invoices, Payments               │  │   │
│  │  │ • Admin: Users, Settings, Logs                 │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │ Main Content Area                              │  │   │
│  │  │ • Role-specific dashboards                     │  │   │
│  │  │ • Feature pages                                │  │   │
│  │  │ • Real-time data                               │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Business Logic Layer (Hooks & Context)

```
┌─────────────────────────────────────────────────────────────┐
│                  Auth Context (React)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ useAuth() Hook                                       │   │
│  │ • Get current user                                   │   │
│  │ • Sign in / Sign up                                  │   │
│  │ • Sign out                                           │   │
│  │ • Check roles (hasRole)                              │   │
│  │ • Refresh user data                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AuthProvider (React Context)                         │   │
│  │ • Manages auth state globally                        │   │
│  │ • Listens to Firebase auth changes                   │   │
│  │ • Provides user data to all components               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Custom Hooks (Future)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  • useOrders() - Firestore orders listener                  │
│  • useInventory() - Warehouse inventory data                │
│  • usePayments() - Accounting payment data                  │
│  • useMetrics() - Dashboard metrics                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. API Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    API Routes                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  /api/gemini/extract-order
│  │
│  ├─ Input: { text: string }
│  │
│  ├─ Processing:
│  │  1. Validate input
│  │  2. Call Gemini 2.5 Flash API
│  │  3. Extract order information
│  │  4. Parse JSON response
│  │  5. Validate extracted data
│  │
│  └─ Output: { success: bool, data?: Order, error?: string }
│
│  Future Routes:
│  • /api/orders/* - CRUD operations
│  • /api/users/* - User management
│  • /api/inventory/* - Stock operations
│  • /api/payments/* - Payment processing
│
└─────────────────────────────────────────────────────────────┘
```

### 4. Data Layer

```
┌──────────────────────────────────────────────────────────┐
│              Firebase (Backend as a Service)             │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ Authentication (Firebase Auth)                    │   │
│  │ • Email/Password authentication                   │   │
│  │ • Session management                              │   │
│  │ • User credentials                                │   │
│  │ • Custom claims (future: roles)                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ Firestore (Document Database)                     │   │
│  │                                                   │   │
│  │  Collections:                                     │   │
│  │  ├─ users/                                        │   │
│  │  │  └─ {uid}                                      │   │
│  │  │     ├─ uid                                     │   │
│  │  │     ├─ email                                   │   │
│  │  │     ├─ displayName                             │   │
│  │  │     ├─ role                                    │   │
│  │  │     ├─ isActive                                │   │
│  │  │     ├─ createdAt                               │   │
│  │  │     ├─ updatedAt                               │   │
│  │  │     └─ lastLogin                               │   │
│  │  │                                                │   │
│  │  └─ orders/                                       │   │
│  │     └─ {orderId}                                  │   │
│  │        ├─ customerId                              │   │
│  │        ├─ customerName                            │   │
│  │        ├─ items []                                │   │
│  │        ├─ totalAmount                             │   │
│  │        ├─ status                                  │   │
│  │        ├─ extractedBy (UID)                       │   │
│  │        ├─ createdAt                               │   │
│  │        └─ updatedAt                               │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ Storage (File uploads - future)                   │   │
│  │ • Order documents                                 │   │
│  │ • User avatars                                    │   │
│  │ • Invoice PDFs                                    │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Authentication Flow

```
User Login
    │
    ▼
┌─────────────────────────┐
│  Login Page             │
│  Email + Password       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Firebase Auth           │
│ signInWithEmailPassword │
└────────┬────────────────┘
         │
         ├─ Success ──┬─ Fetch User Doc from Firestore
         │            │
         │            ▼
         │       ┌──────────────────┐
         │       │ user Firestore   │
         │       │ Document Found?  │
         │       └────┬────────┬────┘
         │            │        │
         │     Yes    │        │ No
         │            ▼        ▼
         │       ┌─────────┐  Logout
         │       │ User    │
         │       │ Context │
         │       └────┬────┘
         │            │
         │            ▼
         │       Dashboard
         │       (Role-based)
         │
         └─ Error ──→ Show Error Message

```

### Order Extraction Flow

```
Customer Service User
         │
         ▼
┌──────────────────────────┐
│ Order Extraction Page    │
│ Paste order text         │
└────────┬─────────────────┘
         │
         ▼ "Extract with AI"
┌──────────────────────────┐
│ /api/gemini/extract      │
│ Send text to Gemini      │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Google Gemini 2.5 Flash  │
│ Analyze & extract data   │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Parse JSON Response      │
│ Validate extracted data  │
└────────┬─────────────────┘
         │
         ├─ Valid ──→ Show Preview
         │            │
         │            ▼
         │       "Save Order"
         │            │
         │            ▼
         │       Save to Firestore
         │            │
         │            ▼
         │       Show Success
         │
         └─ Invalid ─→ Show Error

```

### Real-Time Data Sync Flow (Future)

```
Firestore Database
    │
    ├─ Collection Listener
    │      │
    │      ▼
    │  Change Detected
    │      │
    │      ▼
    │  Custom Hook
    │  (useOrders)
    │      │
    │      ▼
    │  React State Update
    │      │
    │      ├─→ Component A (updated)
    │      ├─→ Component B (updated)
    │      └─→ Component C (updated)
    │
    └─ Multiple tabs/devices sync automatically

```

## Role-Based Access Control (RBAC)

```
┌──────────────────────────────────────────────────────┐
│           User Authenticates                         │
└────────────────────┬─────────────────────────────────┘
                     │
         Fetch user role from Firestore
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
    ┌────────┐  ┌─────────┐  ┌────────┐
    │  Admin │  │   FOM   │  │ Others │
    │        │  │  Levels │  │        │
    │        │  │ 1, 2, 3 │  │        │
    └───┬────┘  └────┬────┘  └───┬────┘
        │            │            │
        ▼            ▼            ▼
   ┌─────────────────────────────────────┐
   │  Role-Based Navigation Sidebar      │
   │  • Show/hide menu items             │
   │  • Enable/disable features          │
   │  • Redirect to appropriate route    │
   └─────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────┐
   │  Protected Route (ProtectedRoute)   │
   │  • Check user is logged in          │
   │  • Check user has required role     │
   │  • Grant/deny access                │
   └─────────────────────────────────────┘

```

## File Organization

```
rachamhub/
│
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (with AuthProvider)
│   ├── globals.css               # Global styles + theme
│   │
│   ├── login/
│   │   ├── page.tsx              # Login page
│   │   └── login-form.tsx        # Login form component
│   │
│   ├── dashboard/
│   │   ├── page.tsx              # Dashboard router
│   │   ├── layout.tsx            # Dashboard layout
│   │   ├── dashboard-nav.tsx     # Sidebar navigation
│   │   │
│   │   ├── customer_service/
│   │   │   ├── page.tsx          # CS dashboard
│   │   │   ├── orders/           # Orders page
│   │   │   │   └── page.tsx
│   │   │   ├── extract/          # AI extraction
│   │   │   │   ├── page.tsx
│   │   │   │   └── order-extraction-form.tsx
│   │   │   └── inquiries/        # Customer inquiries
│   │   │       └── page.tsx
│   │   │
│   │   ├── warehouse/
│   │   │   ├── page.tsx          # Warehouse dashboard
│   │   │   ├── inventory/        # Inventory management
│   │   │   │   └── page.tsx
│   │   │   └── orders/           # Orders for processing
│   │   │       └── page.tsx
│   │   │
│   │   ├── fom1/, fom2/, fom3/   # FOM dashboards
│   │   │   ├── page.tsx
│   │   │   └── orders/
│   │   │       └── page.tsx
│   │   │
│   │   ├── accounting/
│   │   │   ├── page.tsx          # Accounting dashboard
│   │   │   ├── invoices/         # Invoice management
│   │   │   │   └── page.tsx
│   │   │   └── payments/         # Payment tracking
│   │   │       └── page.tsx
│   │   │
│   │   └── admin/
│   │       ├── page.tsx          # Admin dashboard
│   │       ├── users/            # User management
│   │       │   └── page.tsx
│   │       ├── settings/         # System settings
│   │       │   └── page.tsx
│   │       └── overview/         # System overview
│   │           └── page.tsx
│   │
│   └── api/                      # API Routes
│       └── gemini/
│           └── extract-order/
│               └── route.ts      # Gemini extraction endpoint
│
├── lib/                          # Core logic
│   ├── firebase.ts               # Firebase initialization
│   ├── auth-context.tsx          # Auth provider & hooks
│   └── types.ts                  # TypeScript types
│
├── components/
│   ├── ui/                       # shadcn/ui components (pre-installed)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── spinner.tsx
│   │   └── ... more components
│   │
│   └── protected-route.tsx       # Route protection wrapper
│
├── .env.local.example            # Environment template
├── next.config.mjs               # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS config
├── tsconfig.json                 # TypeScript config
│
└── Documentation/
    ├── README.md                 # Main documentation
    ├── SETUP_GUIDE.md            # Detailed setup
    ├── QUICKSTART.md             # Quick start (5 min)
    ├── ARCHITECTURE.md           # This file
    ├── PROJECT_SUMMARY.md        # Project overview
    └── IMPLEMENTATION_CHECKLIST.md # Setup checklist
```

## Technology Integration Points

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router)                                │
├─────────────────────────────────────────────────────────┤
│  • Server Components by default                         │
│  • Client Components for interactivity                  │
│  • Server Actions (future: form submissions)            │
│  • API Routes (/api/*)                                  │
│  • Automatic code splitting                             │
│  • Built-in image optimization                          │
└─────────────────────────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
 ┌────────────────┐ ┌──────────────┐ ┌────────────────┐
 │ Tailwind CSS   │ │  shadcn/ui   │ │  TypeScript    │
 │ • Responsive   │ │  • Components│ │  • Type safe   │
 │ • Mobile-first │ │  • Accessible│ │  • Dev tools   │
 │ • Lagos theme  │ │  • Themeable │ │  • Intellisense|
 └────────────────┘ └──────────────┘ └────────────────┘
    │
    └─────────┬─────────┐
              ▼         ▼
        ┌──────────┐ ┌──────────────────┐
        │ Firebase │ │ Google Gemini    │
        │ • Auth   │ │ • AI extraction  │
        │ • Store  │ │ • Text analysis  │
        │ • Listen │ │ • JSON parsing   │
        └──────────┘ └──────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────┐
│           Client-Side Security                      │
├─────────────────────────────────────────────────────┤
│  • Environment variables protected                  │
│  • Protected routes with auth checks                │
│  • Role-based access control                        │
│  • Secure session management                        │
│  • HTTP-only cookies (Firebase handles)             │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│          Server-Side Security (Firebase)            │
├─────────────────────────────────────────────────────┤
│  • API key validation                               │
│  • Authentication enforcement                       │
│  • Authorization rules                              │
│  • Firestore security rules                         │
│  • Rate limiting (Firebase)                         │
│  • DDoS protection                                  │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│         Data-Level Security                         │
├─────────────────────────────────────────────────────┤
│  • Row-level security (Firestore rules)             │
│  • User can only access own data                    │
│  • Role-based data access                           │
│  • Encrypted at rest & in transit                   │
│  • Regular backups                                  │
└─────────────────────────────────────────────────────┘
```

## Scalability Considerations

```
┌──────────────────────────────────────────────────────┐
│ Current Architecture (Phase 1)                       │
├──────────────────────────────────────────────────────┤
│ • Single Firestore instance                          │
│ • No caching layer                                   │
│ • Direct API calls                                   │
│ • Suitable for: 0-1000 users                         │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│ Recommended for Phase 2 (1000-10000 users)           │
├──────────────────────────────────────────────────────┤
│ • Add Redis caching layer                            │
│ • Implement query optimization                       │
│ • Add pagination                                     │
│ • Add database indexing                              │
│ • Monitor Firestore metrics                          │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│ Recommended for Phase 3 (10000+ users)               │
├──────────────────────────────────────────────────────┤
│ • Multi-region Firestore                             │
│ • CDN for static assets                              │
│ • Message queue (Pub/Sub)                            │
│ • Search service (Elasticsearch)                     │
│ • GraphQL API layer                                  │
│ • Microservices architecture                         │
└──────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌──────────────────────────────────────────────────────┐
│           Development Environment                    │
├──────────────────────────────────────────────────────┤
│  • Local machine                                     │
│  • pnpm dev (Next.js dev server)                     │
│  • Firebase Emulator (optional)                      │
│  • .env.local with test credentials                  │
└──────────────────────────────────────────────────────┘
                    │
         Build & Test
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│           Production Deployment                      │
├──────────────────────────────────────────────────────┤
│  Option 1: Vercel (Recommended)                      │
│  • Automatic deployments from GitHub                 │
│  • Built-in performance monitoring                   │
│  • Edge functions support                            │
│  • Environment variable management                   │
│                                                      │
│  Option 2: Other Cloud Providers                     │
│  • AWS EC2 / ECS / Lambda                            │
│  • Google Cloud Run / App Engine                     │
│  • Azure App Service                                 │
│  • DigitalOcean App Platform                         │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│          Backend Services (Firebase)                 │
├──────────────────────────────────────────────────────┤
│  • Firebase Auth (Google-managed)                    │
│  • Firestore (Google-managed)                        │
│  • Cloud Functions (optional, future)                │
│  • Cloud Storage (optional, future)                  │
└──────────────────────────────────────────────────────┘
```

## Performance Optimization

```
Frontend Performance:
├─ Code Splitting (Next.js automatic)
├─ Image Optimization (next/image)
├─ Static Generation (where possible)
├─ Dynamic Rendering (for auth pages)
├─ CSS Optimization (Tailwind purging)
└─ Bundle Analysis (future)

Data Fetching:
├─ Firestore Queries (indexed)
├─ Pagination (for large datasets)
├─ Caching (Firestore offline)
├─ Real-time Listeners (optimized)
└─ Query Optimization (future)

API Performance:
├─ Request Batching (future)
├─ Response Caching (future)
├─ Rate Limiting (Firebase)
├─ Error Handling (with retries)
└─ Monitoring (CloudTrace, future)
```

---

**Architecture Last Updated:** 2024  
**Status:** ✅ Production Ready

For implementation details, see other documentation files.
