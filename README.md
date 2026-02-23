# InvenTrack — AI-Powered Inventory Management System

A modern, full-stack inventory management system built with **Next.js 16**, **Supabase**, and **Google Gemini AI**. Features real-time updates, role-based access control, AI-powered analytics, and a beautiful responsive UI.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase)
![Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)

## Live Demo

🔗 **[https://your-app.vercel.app](https://your-app.vercel.app)** _(update after deployment)_

**Test Credentials:**
- **Admin:** `admin@inventracker.com` / _(set during Supabase setup)_

---

## Features

### Core Inventory Management
- ✅ Full **CRUD** operations for products (create, read, update, delete)
- ✅ **Stock adjustments** — inbound, outbound, and manual adjustments with notes
- ✅ **Auto status tracking** — active, low stock, out of stock (via DB triggers)
- ✅ **Category management** — organized by product categories
- ✅ **Global search** with category and status filters
- ✅ **Sortable columns** — click any column header to sort
- ✅ **Paginated data table** with configurable page sizes
- ✅ **CSV export** — download full inventory as CSV

### AI-Powered Features (Gemini 2.5 Flash)
- 🤖 **Conversational AI assistant** — natural language interface to inventory
- 🤖 **5 AI tools** with function calling:
  - `search_inventory` — find products by name, category, or status
  - `get_stock_movements` — analyze movement patterns over time
  - `get_low_stock_items` — identify items needing restock
  - `get_analytics` — overview, category breakdown, movement summary, top movers
  - `update_stock_threshold` — intelligently adjust reorder points with data-backed reasoning
- 🤖 **Multi-turn conversations** — maintains context across messages
- 🤖 **Parallel tool execution** — fast responses using multiple data sources

### Real-Time & Notifications
- 🔔 **Real-time product updates** — inventory table auto-updates via Supabase Realtime
- 🔔 **Low stock notifications** — automatic alerts when stock drops below threshold
- 🔔 **Out of stock notifications** — immediate alerts for zero-stock items
- 🔔 **Notification bell** with unread count and mark-as-read

### Dashboard & Analytics
- 📊 **KPI cards** — total products, low stock alerts, total value, categories
- 📊 **Category breakdown** — horizontal bar chart
- 📊 **Stock status distribution** — pie chart with legend
- 📊 **30-day movement trends** — area chart (inbound vs outbound)
- 📊 **Recent activity feed** — latest stock movements

### Security & Access Control
- 🔐 **Role-based access control** (RBAC) — Admin, Manager, Viewer
- 🔐 **Row-Level Security** (RLS) — enforced at the database level
- 🔐 **Invite-only registration** — admins invite users via email
- 🔐 **Admin panel** — manage users, change roles, send invitations
- 🔐 **Protected routes** — middleware-enforced authentication

### UX & Design
- 🎨 **Dark/Light mode** with system preference detection
- 🎨 **Responsive design** — works on desktop, tablet, and mobile
- 🎨 **Mobile sidebar** — sheet-based navigation for small screens
- 🎨 **shadcn/ui components** — consistent, accessible UI
- 🎨 **Loading states** — skeleton loaders and spinners throughout
- 🎨 **Toast notifications** — feedback for every action

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, React 19, Turbopack) |
| **Language** | TypeScript 5 |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email/password, invite flow) |
| **Real-time** | Supabase Realtime (WebSocket subscriptions) |
| **AI** | Google Gemini 2.5 Flash (`@google/genai` SDK) |
| **UI** | Tailwind CSS 4 + shadcn/ui |
| **Charts** | Recharts (via shadcn/ui chart components) |
| **Tables** | TanStack React Table v8 |
| **Forms** | React Hook Form + Zod validation |
| **Icons** | Lucide React |
| **Deployment** | Vercel |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser    │────▸│  Next.js (Vercel) │────▸│    Supabase     │
│  (React 19)  │◂────│  App Router + API │◂────│  PostgreSQL     │
└─────────────┘     └────────┬─────────┘     │  Auth / RLS     │
                             │               │  Realtime       │
                             ▼               └─────────────────┘
                    ┌──────────────────┐
                    │   Gemini 2.5     │
                    │  Function Calling │
                    └──────────────────┘
```

**Key Patterns:**
- **Server Components** for data fetching (dashboard, movements)
- **Client Components** for interactivity (inventory table, AI chat, forms)
- **API Routes** for server-only operations (AI chat, admin user management)
- **Service Role Client** for AI tools and admin operations (bypasses RLS)
- **Middleware** for auth guard (all routes except `/login` and `/auth/confirm`)

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (synced from auth.users via trigger) |
| `categories` | Product categories |
| `products` | Inventory items with quantity, price, threshold, status |
| `stock_movements` | Audit log of all quantity changes |
| `notifications` | In-app notification records |

**Key DB Features:**
- `handle_new_user()` trigger — auto-creates profile on signup
- `handle_product_stock_change()` trigger — auto-updates status, creates low-stock / out-of-stock notifications
- `get_low_stock_items()` RPC — returns items below threshold
- `get_dashboard_stats()` RPC — aggregated KPIs in one call
- Full RLS policies using `auth.jwt()->'app_metadata'->>'role'`

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Google AI Studio](https://aistudio.google.com) API key
- (Optional) [Vercel](https://vercel.com) account for deployment

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/InventoryManagement.git
cd InventoryManagement/inventory-app
npm install
```

### 2. Set Up Supabase
1. Create a new Supabase project
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. This creates all tables, triggers, RLS policies, and seed data
4. Go to **Authentication > Settings** and ensure email confirmations are enabled

### 3. Create Admin User
1. In the Supabase dashboard, go to **Authentication > Users**
2. Click **Add User** → enter email and password
3. Then run this SQL to set the admin role:
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'admin@inventracker.com';
```

### 4. Configure Environment Variables
```bash
cp .env.example .env.local
```
Edit `.env.local` with your values:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) and sign in with your admin credentials.

### 6. Deploy to Vercel
```bash
vercel
```
Add the same environment variables in **Vercel Dashboard > Settings > Environment Variables**.

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected routes (with sidebar layout)
│   │   ├── page.tsx          # Dashboard with KPIs and charts
│   │   ├── inventory/        # CRUD data table
│   │   ├── movements/        # Audit log
│   │   ├── ai-assistant/     # AI chat interface
│   │   └── settings/         # Admin user management
│   ├── login/                # Login page
│   ├── auth/confirm/         # Invite link handler
│   └── api/
│       ├── chat/             # Gemini AI agent endpoint
│       └── admin/users/      # User management API
├── components/
│   ├── dashboard/            # KPI cards, charts
│   ├── inventory/            # Data table, forms, dialogs
│   ├── layout/               # Sidebar, header, theme toggle
│   ├── notifications/        # Notification bell
│   ├── providers/            # Auth & theme providers
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── ai/                   # Gemini tools, executor, system prompt
│   ├── supabase/             # Client & server Supabase clients
│   └── types/                # TypeScript types
└── middleware.ts              # Auth guard
```

---

## RBAC Permissions

| Action | Admin | Manager | Viewer |
|--------|-------|-------|--------|
| View dashboard & inventory | ✅ | ✅ | ✅ |
| Add/edit products | ✅ | ✅ | ❌ |
| Adjust stock levels | ✅ | ✅ | ❌ |
| Delete products | ✅ | ❌ | ❌ |
| Use AI assistant | ✅ | ✅ | ✅ |
| AI: update thresholds | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

---

## AI Agent Capabilities

The AI assistant uses **Gemini 2.5 Flash** with function calling to interact with your inventory data:

1. **Search & Discovery** — "Find all products with less than 20 units"
2. **Movement Analysis** — "Show me stock movements for USB-C Hub over the last month"
3. **Threshold Recommendations** — "Analyze the Wireless Mouse movements and suggest a better low-stock threshold"
4. **Analytics** — "Give me a complete inventory overview" or "Which categories have the most value?"
5. **Smart Updates** — "Set the threshold for Wireless Mouse to 15" (with before/after confirmation)

The agent processes up to **8 rounds** of tool calls per request and executes multiple tools in parallel for fast responses.

---

## License

MIT
