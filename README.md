# RachamHub - Lagos Logistics Management System

A modern, production-ready Next.js 15 application for managing logistics operations in Lagos, Nigeria.

## 🚀 Overview

RachamHub is a comprehensive logistics management system designed specifically for Nigerian logistics companies. It features:

- **Role-Based Access Control**: 7 distinct roles with customized dashboards
- **AI-Powered Order Extraction**: Google Gemini AI extracts order details from text
- **Real-Time Updates**: Firestore listeners for live data synchronization
- **Responsive Design**: Mobile-first design optimized for all devices
- **Firebase Authentication**: Secure email/password authentication
- **Lagos Theme**: Green, Yellow, and Black color scheme inspired by Nigeria

## 📋 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Firebase (Auth + Firestore)
- **AI**: Google Gemini 2.5 Flash
- **State Management**: React Context API + Custom Hooks

## 🎯 Key Features

### 1. Role-Based Dashboards

Seven specialized dashboards for different user roles:

| Role                 | Features                                          |
| -------------------- | ------------------------------------------------- |
| **Customer Service** | Order creation, AI extraction, customer inquiries |
| **Warehouse**        | Inventory management, stock tracking, receiving   |
| **FOM Level 1/2/3**  | Order fulfillment, status updates, operations     |
| **Accounting**       | Invoices, payments, reconciliation, reports       |
| **Admin**            | User management, system settings, analytics       |

### 2. AI Order Extraction

- Paste order information as text
- Google Gemini AI automatically extracts:
  - Customer name and ID
  - Items and quantities
  - Total amount
  - Special notes
- Save extracted orders directly to Firestore

### 3. Firestore Integration

- Real-time data synchronization
- Automatic offline support
- Type-safe queries with TypeScript
- Security rules for data protection

### 4. Authentication

- Email/password authentication via Firebase
- Session persistence
- Automatic logout on auth errors
- Secure token management

## 📁 Project Structure

```
rachamhub/
├── app/
│   ├── api/
│   │   └── gemini/
│   │       └── extract-order/       # Gemini API route
│   ├── login/
│   │   ├── page.tsx                 # Login page
│   │   └── login-form.tsx           # Login form component
│   ├── dashboard/
│   │   ├── page.tsx                 # Dashboard router
│   │   ├── layout.tsx               # Dashboard layout
│   │   ├── dashboard-nav.tsx        # Sidebar navigation
│   │   ├── customer_service/        # CS role dashboards
│   │   │   ├── page.tsx
│   │   │   ├── orders/
│   │   │   ├── extract/             # AI extraction page
│   │   │   └── inquiries/
│   │   ├── warehouse/               # Warehouse dashboards
│   │   ├── fom/                     # FOM dashboards
│   │   ├── accounting/              # Accounting dashboards
│   │   └── admin/                   # Admin dashboards
│   ├── globals.css                  # Global styles + theme
│   └── layout.tsx                   # Root layout
├── lib/
│   ├── firebase.ts                  # Firebase initialization
│   ├── auth-context.tsx             # Auth provider & hooks
│   └── types.ts                     # TypeScript types
├── components/
│   └── protected-route.tsx          # Route protection
└── SETUP_GUIDE.md                   # Detailed setup instructions
```

## 🔧 Setup Instructions

### Quick Start

1. **Install Dependencies**

   ```bash
   pnpm install
   ```

2. **Configure Environment Variables**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Firebase and Gemini credentials
   ```

3. **Start Development Server**

   ```bash
   pnpm dev
   ```

4. **Access the Application**
   - Open http://localhost:3000
   - You'll be redirected to login

### Detailed Setup

For complete Firebase and Gemini setup instructions, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## 🔑 Environment Variables

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Google Gemini AI
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
```

## 👥 User Roles

### Customer Service (customer_service)

- View and manage orders
- Extract orders using AI
- Handle customer inquiries
- Dashboard: `/dashboard/customer_service`

### Warehouse (warehouse)

- Inventory management
- Stock tracking
- Receiving operations
- Dashboard: `/dashboard/warehouse`

### FOM Levels (fom1, fom2, fom3)

- Order fulfillment operations
- Status tracking
- Escalation handling
- Dashboard: `/dashboard/fom`

### Accounting (accounting)

- Invoice management
- Payment tracking
- Financial reports
- Dashboard: `/dashboard/accounting`

### Administrator (admin)

- User management
- System settings
- Audit logs
- Dashboard: `/dashboard/admin`

## 🎨 Design System

### Colors (Lagos Theme)

- **Primary (Green)**: `#1B7A3E` - Brand color
- **Secondary (Yellow)**: `#FCD34D` - Accent/highlight
- **Neutral**: Black, White, and Grays

### Typography

- **Headings**: Geist (system font)
- **Body**: Geist (system font)
- **Monospace**: Geist Mono

### Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly interface elements

## 🔐 Security Features

- Firebase authentication with secure session management
- Type-safe TypeScript for compile-time safety
- Environment variable protection for sensitive data
- Firestore security rules for data access control
- Protected routes with role-based access

## 🚀 Deployment

### Deploy to Vercel (Recommended)

```bash
# Connect to GitHub
git push origin main

# Vercel will automatically deploy
# Add environment variables in Vercel project settings
```

### Deploy to Other Platforms

The app works with any Node.js hosting (AWS, GCP, etc.):

1. Set all environment variables
2. Build: `pnpm build`
3. Start: `pnpm start`

## 📱 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### "Firebase config is missing"

- Ensure `.env.local` has all `NEXT_PUBLIC_FIREBASE_*` variables

### "User profile not found"

- Create a Firestore document in the `users` collection with matching Firebase UID

### "Gemini API key not configured"

- Set `GOOGLE_GEMINI_API_KEY` in `.env.local`

### "Cannot extract order"

- Verify Gemini API is enabled in Google Cloud Console
- Try with clearer order information

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Google Gemini API](https://ai.google.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui Components](https://ui.shadcn.com)

## 📄 License

This project is proprietary software for RachamHub Nigeria.

## 👨‍💻 Development

### Available Scripts

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint

# Type checking
pnpm type-check
```

### Code Structure

- **Server Components**: Used by default in App Router
- **Client Components**: Marked with `'use client'` where needed
- **Custom Hooks**: In `/lib` directory
- **Components**: Reusable UI components in `/components`

## 🤝 Contributing

For internal development, follow the established patterns:

1. Create feature branches from `main`
2. Use TypeScript throughout
3. Follow the existing component structure
4. Test across mobile and desktop
5. Create pull request with description

## 📞 Support

For issues or questions:

1. Check the SETUP_GUIDE.md
2. Review browser console for errors
3. Check Firebase console for auth/database issues
4. Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Made with ❤️ for RachamHub Nigeria**
