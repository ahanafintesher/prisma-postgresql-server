# WorkSphere EMS — Super Admin Enterprise Backend API

> High-performance enterprise REST API gateway for the **WorkSphere Enterprise Management System (EMS) Super Admin Portal**. Built with Node.js, Express 5, TypeScript, Prisma ORM 7, Neon Serverless PostgreSQL, and a resilient Redis caching layer.

---

## 🌐 Live Production Links

- **Production API Gateway:** [https://postgresql-prisma-server.vercel.app](https://postgresql-prisma-server.vercel.app)
- **Interactive API Explorer & Gateway Root:** [https://postgresql-prisma-server.vercel.app/](https://postgresql-prisma-server.vercel.app/)
- **Live Health & Telemetry Check:** [https://postgresql-prisma-server.vercel.app/health](https://postgresql-prisma-server.vercel.app/health)
- **Multi-Service Telemetry:** [https://postgresql-prisma-server.vercel.app/health/services](https://postgresql-prisma-server.vercel.app/health/services)
- **Alternative Production Alias:** [https://postgresql-prisma-server-hjku17p4v-ahanafinteshers-projects.vercel.app](https://postgresql-prisma-server-hjku17p4v-ahanafinteshers-projects.vercel.app)

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v20+ / v26) | JavaScript/TypeScript server runtime |
| **Framework** | Express.js 5.2 | Fast, unopinionated minimalist web framework with async error boundaries |
| **Language** | TypeScript 7.0 | Type-safe enterprise JavaScript codebase |
| **Database** | PostgreSQL (Neon Serverless) | Cloud-native serverless PostgreSQL with connection pooling & autoscaling |
| **ORM** | Prisma ORM 7.9 | Type-safe query engine with `@prisma/adapter-pg` driver adapter |
| **Cache Engine** | Redis (`ioredis`) + In-Memory Fallback | Hybrid cache with zero-downtime offline fallback for development & cloud resiliency |
| **Authentication** | JWT (`jsonwebtoken`) & `bcrypt` | HMAC SHA-256 access & refresh token rotation, password hashing with salt rounds |
| **Validation & Middleware**| CORS, Body Parser, Custom RBAC | Cross-origin policies, malformed JSON guards, and 19 granular permissions |
| **Dev Tools** | `tsx`, `prisma CLI`, `dotenv` | Fast TypeScript execution, schema migrations, and environment configuration |
| **Deployment** | Vercel Serverless Functions | Serverless edge deployment configured via `vercel.json` |

---

## 🏗️ Architecture & Implementation

### 1. Flexible Multi-Prefix Route Mounting
The Express router mounts all controllers across **three URL tiers**, ensuring out-of-the-box compatibility with Next.js App Router frontends (`ems-admin`), standard REST clients, and versioned enterprise SDKs:

- **Direct Tier:** `/{service}/*` (e.g. `POST /auth/login`, `GET /companies`)
- **Standard API Tier:** `/api/{service}/*` (e.g. `GET /api/companies`, `GET /api/health`)
- **Versioned Super Admin Tier:** `/api/v1/super-admin/{service}/*` (e.g. `GET /api/v1/super-admin/dashboard/metrics`)

### 2. High-Speed Hybrid Redis Caching
- **Transparent Middleware:** Caches successful safe `GET` responses with automatic `X-Cache: HIT/MISS` and `X-Cache-Engine: redis/memory` headers.
- **Resilient Fallback:** If local or remote Redis is offline, the system seamlessly transitions to an in-memory TTL cache without crashing or reconnect spam.
- **Category Invalidation:** Write operations (`POST`, `PATCH`, `DELETE`) automatically purge related cache namespaces (`companies`, `subscriptions`, `plans`, `payments`, `promotions`, `tickets`, `announcements`, `admin_users`, `roles`, `settings`).

### 3. Production Pagination & Sorting Engine
Every paginated endpoint uses the centralized [`src/lib/pagination.ts`](file:///l:/postgresql-prisma-server/src/lib/pagination.ts) engine:
- **Parameter Aliases:** Supports `page` / `p`, `limit` / `pageSize` / `per_page` / `size`.
- **Dynamic Sorting:** Supports `sortBy` (field allowlist) and `sortOrder` (`asc` / `desc`).
- **Standardized Envelope:** Returns both `pagination` and `meta` with rich navigation flags (`hasNextPage`, `hasPrevPage`, `nextPage`, `prevPage`, `totalPages`).

### 4. Enterprise Security & RBAC
- **Token Rotation:** 1-hour access tokens and 7-day refresh tokens.
- **Granular Permissions:** 19 granular permissions across Dashboard, Companies, Billing, Support, Governance, DevOps, and Settings.
- **Auditing:** Immutable audit logs recorded for every sensitive action with actor email, role, target resource, outcome, and timestamp.
- **Global Error Handling:** Process-level crash prevention and JSON body-parser syntax error guards.

---

## 📂 Project Directory Structure

```text
postgresql-prisma-server/
├── api/                         # Vercel serverless entrypoint
│   └── index.ts                 # Serverless handler exporting Express app
├── docs/                        # Complete technical documentation
│   ├── BACKEND_INTEGRATION.md   # Integration & gap analysis guide
│   └── api endpoints.md         # Exhaustive 2,700+ line endpoint catalog
├── prisma/                      # Database schema & migrations
│   ├── schema.prisma            # Prisma schema models & enums
│   └── seed.ts                  # Baseline platform roles & root admin seed
├── src/                         # Application source code
│   ├── lib/                     # Shared utilities & services
│   │   ├── jwt.ts               # JWT signing, verification & token rotation
│   │   ├── pagination.ts        # Centralized pagination & sorting engine
│   │   ├── prisma.ts            # Neon PostgreSQL connection pooled client
│   │   ├── redis.ts             # Redis & in-memory fallback cache manager
│   │   └── response.ts          # Unified JSON response & pagination envelope
│   ├── middleware/              # Express middlewares
│   │   ├── auth.middleware.ts   # JWT verification & RBAC permission guards
│   │   └── cache.middleware.ts  # HTTP response caching & cache invalidation
│   ├── routes/                  # Route index & mounting tiers
│   │   ├── index.ts             # Gateway prefix router (/, /api, /api/v1/super-admin)
│   │   └── root.ts              # Interactive HTML API explorer & gateway dashboard
│   ├── services/                # Feature-based domain modules
│   │   ├── admin-users/         # Operator accounts CRUD & invitations
│   │   ├── audit/               # Immutable audit logging & export
│   │   ├── auth/                # Login, 2FA challenge, password reset, sessions
│   │   ├── companies/           # Tenant lifecycle, KYB verification & suspensions
│   │   ├── dashboard/           # Real-time KPI metrics & financial telemetry
│   │   ├── payments/            # Transaction ledger, refunds & promotional coupons
│   │   ├── roles/               # RBAC matrix & granular permission assignments
│   │   ├── settings/            # System settings, security policy & telemetry
│   │   ├── subscriptions/       # SaaS pricing tiers, versions & active plans
│   │   └── support/             # Customer desk tickets, replies & announcements
│   ├── app.ts                   # Express application setup & middleware stack
│   └── server.ts                # Server startup & process crash guards
├── .env.example                 # Backend environment variable template
├── .env.frontend.example        # Next.js frontend (.env.local) template
├── package.json                 # Dependencies and npm scripts
├── tsconfig.json                # TypeScript compiler configuration
└── vercel.json                  # Vercel deployment routing configuration
```

---

## 🚀 Getting Started & Local Setup

### 1. Prerequisites
- **Node.js:** `v20.x` or higher (tested on `v26.1.0`)
- **Package Manager:** `npm` (or `bun` / `pnpm`)
- **PostgreSQL:** Cloud Neon connection string or local PostgreSQL instance

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/ahanafintesher/prisma-postgresql-server.git
cd prisma-postgresql-server
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Configure your environment variables:
```env
# PostgreSQL Database (Neon Serverless Connection String with SSL)
DATABASE_URL="postgresql://user:password@ep-host.region.aws.neon.tech/neondb?sslmode=require"

# JWT Token Secret Key (HMAC SHA-256)
JWT_SECRET="your-secure-64-character-hex-secret-key"

# Application Listening Port
PORT=5000

# Node Environment
NODE_ENV="development"

# Redis Cache Service (Optional: fallback memory cache activates automatically if offline)
REDIS_URL="redis://127.0.0.1:6379"
REDIS_CACHE_ENABLED="true"

# Frontend Allowed Origins (Comma-separated for CORS)
FRONTEND_URL="http://localhost:3000,http://localhost:3001,https://admin.worksphere.com"
```

### 4. Database Setup & Seeding
Generate Prisma Client types and seed initial platform roles, permissions, root admin, and multi-page tenant data:
```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (if needed)
npx prisma db push

# Seed platform baseline data & tenant records
npx tsx prisma/seed.ts
npx tsx scratch/seed_all_dummy_data.ts
```

### 5. Running the Application
```bash
# Start in watch mode with tsx
npm run dev
```
The server will start listening at: `http://localhost:5000`

---

## 📡 API Endpoints Reference

All endpoints below support both `/api/{path}` and `/api/v1/super-admin/{path}` prefixes.

### 1. System & Telemetry Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/` | Public | Interactive HTML API Explorer & Dashboard |
| `GET` | `/health` | Public | System status, service identity & Redis engine health |
| `GET` | `/health/services` | Authenticated | Multi-service health monitoring (PostgreSQL, Redis, BullMQ, S3) |

### 2. Authentication & Session Endpoints (`/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/auth/login` | Public | Authenticate operator with email & password |
| `POST` | `/auth/refresh` | Public | Exchange refresh token for fresh access token |
| `GET` | `/auth/me` | Authenticated | Retrieve authenticated admin profile & permissions |
| `POST` | `/auth/verify-2fa` | Public | Complete 2FA challenge via TOTP verification code |
| `POST` | `/auth/forgot-password` | Public | Request password recovery email dispatch |
| `POST` | `/auth/reset-password` | Public | Reset account password with one-time security token |
| `POST` | `/auth/logout` | Authenticated | Revoke current admin session |
| `GET` | `/auth/sessions` | Authenticated | List all active sessions across devices |
| `DELETE`| `/auth/sessions/:id` | Authenticated | Terminate a specific session remotely |

### 3. Dashboard & Platform Telemetry (`/dashboard`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/dashboard/metrics` | Authenticated | Platform KPI summary cards (MRR, companies, active seats) |
| `GET` | `/dashboard/activity` | Authenticated | Real-time audit activity feed |
| `GET` | `/dashboard/growth` | Authenticated | Historical monthly revenue & tenant growth analytics |
| `GET` | `/dashboard/charts` | Authenticated | Chart datasets for revenue, signups, and churn |

### 4. Tenant Companies Management (`/companies`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/companies` | Authenticated | Paginated directory with search, status & KYB filters |
| `GET` | `/companies/:id` | Authenticated | Retrieve company profile, active subscription & counts |
| `POST` | `/companies` | `companies.manage` | Provision a new tenant company and assign plan |
| `PATCH`| `/companies/:id` | `companies.manage` | Update tenant metadata (name, slug, email) |
| `POST` | `/companies/:id/suspend` | `companies.suspend` | Suspend company access with mandatory audit reason |
| `POST` | `/companies/:id/reactivate` | `companies.suspend` | Restore suspended company access |
| `POST` | `/companies/:id/verify` | `companies.verify` | Approve tenant KYB verification submission |
| `POST` | `/companies/:id/reject` | `companies.verify` | Reject tenant KYB submission with reason |
| `DELETE`| `/companies/:id` | `companies.manage` | Permanently delete company and cascade records |

### 5. SaaS Plans & Subscriptions (`/plans`, `/subscriptions`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/plans` | Authenticated | List all active subscription tiers and pricing versions |
| `POST` | `/plans` | `plans.manage` | Create a new subscription tier package |
| `PATCH`| `/plans/:id` | `plans.manage` | Update subscription tier features, limits & pricing |
| `GET` | `/subscriptions` | Authenticated | Paginated list of company subscriptions & statuses |
| `POST` | `/subscriptions/:id/change-plan` | `subscriptions.manage` | Migrate company subscription to a new plan version |
| `POST` | `/subscriptions/:id/extend-trial` | `subscriptions.manage` | Grant complimentary trial extension days |
| `POST` | `/subscriptions/:id/cancel` | `subscriptions.manage` | Cancel subscription at period end |

### 6. Payments, Ledgers & Promotions (`/payments`, `/promotions`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/payments` | Authenticated | Paginated transaction ledger with gateway & status filters |
| `GET` | `/payments/:id` | Authenticated | View transaction details and receipt information |
| `POST` | `/payments/:id/refund` | `payments.refund` | Issue full or partial payment refund with reason |
| `POST` | `/payments/:id/reconcile`| `payments.manage` | Reconcile payment record against payment gateway |
| `GET` | `/promotions` | Authenticated | Paginated list of promotional coupons & usage counters |
| `POST` | `/promotions` | `payments.manage` | Create a new percentage or fixed discount code |
| `PATCH`| `/promotions/:id` | `payments.manage` | Update discount parameters or deactivate coupon |
| `DELETE`| `/promotions/:id` | `payments.manage` | Remove a promotional discount code |

### 7. Support Desk & Announcements (`/tickets`, `/announcements`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/tickets` | Authenticated | Paginated support tickets desk with priority/status filters |
| `GET` | `/tickets/:id` | Authenticated | Get full conversation thread and internal notes |
| `POST` | `/tickets/:id/replies` | `tickets.reply` | Submit public support reply to tenant client |
| `POST` | `/tickets/:id/notes` | `tickets.notes` | Add staff-only internal ticket note |
| `PATCH`| `/tickets/:id/status` | Authenticated | Update ticket status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`) |
| `POST` | `/tickets/:id/assign` | `tickets.assign` | Assign ticket to an administrative operator |
| `GET` | `/announcements` | Authenticated | List broadcast announcement banners |
| `POST` | `/announcements` | `announcements.manage` | Publish broadcast announcement to all tenant portals |
| `PATCH`| `/announcements/:id` | `announcements.manage` | Update announcement content or target audience |
| `DELETE`| `/announcements/:id` | `announcements.manage` | Unpublish and delete broadcast announcement |

### 8. Platform Operators & RBAC Governance (`/admin-users`, `/roles`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/admin-users` | Authenticated | Paginated list of platform operator accounts & roles |
| `POST` | `/admin-users` | `admins.manage` | Invite a new platform operator and assign role |
| `PATCH`| `/admin-users/:id` | `admins.manage` | Update operator role assignment or toggle status |
| `DELETE`| `/admin-users/:id` | `admins.manage` | Revoke operator account and delete record |
| `GET` | `/roles` | Authenticated | List all platform roles with attached permissions |
| `POST` | `/roles` | `roles.manage` | Create custom role with specific permission keys |
| `PATCH`| `/roles/:id` | `roles.manage` | Edit custom role permissions and metadata |
| `DELETE`| `/roles/:id` | `roles.manage` | Remove custom role (system roles are protected) |
| `GET` | `/roles/permissions` | Authenticated | Catalog of all 19 granular platform permission keys |

### 9. Platform Settings & Audit Logs (`/settings`, `/audit-logs`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/settings` | Authenticated | Retrieve platform configuration (secrets masked) |
| `PATCH`| `/settings` | `settings.manage` | Update platform settings key-value configuration |
| `GET` | `/security-policy` | Authenticated | View platform security and session governance policy |
| `PATCH`| `/security-policy` | `settings.manage` | Update MFA enforcement, session timeout & IP allowlists |
| `GET` | `/integrations` | Authenticated | Diagnostic status of Stripe, SSLCommerz, bKash, SendGrid, S3 |
| `POST` | `/integrations/:id/test` | Authenticated | Execute diagnostic ping to external integration provider |
| `GET` | `/audit-logs` | Authenticated | Query immutable audit log stream with resource filters |
| `GET` | `/logs/export` | `audit.export` | Export compliance audit trail to CSV or JSON report |

---

## 📄 Pagination & Filtering Usage

All listing endpoints support standard query parameters:

```http
GET /api/v1/super-admin/companies?page=2&pageSize=10&sortBy=name&sortOrder=asc&status=ACTIVE&search=Acme
```

### Supported Parameters:
- `page` (or `p`): 1-indexed target page number (default: `1`).
- `limit` (or `pageSize`, `per_page`, `size`): Records per page (default: `10`, max: `100`).
- `sortBy` (or `sort`, `orderBy`): Column field to order by (`createdAt`, `name`, `amount`, `status`, etc.).
- `sortOrder` (or `order`, `dir`): Sorting direction (`"asc"` or `"desc"`, default: `"desc"`).

### Standard Response Envelope:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 2,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": true,
    "nextPage": 3,
    "prevPage": 1
  },
  "meta": {
    "page": 2,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": true,
    "nextPage": 3,
    "prevPage": 1
  }
}
```

---

## 💻 Next.js Frontend Integration

To connect the Next.js Super Admin portal (`ems-admin`) to this backend:

1. Copy [`.env.frontend.example`](file:///l:/postgresql-prisma-server/.env.frontend.example) to `ems-admin/.env.local`:
   ```env
   # Live Cloud Production:
   NEXT_PUBLIC_API_URL=https://postgresql-prisma-server.vercel.app/api
   API_BASE_URL=https://postgresql-prisma-server.vercel.app/api

   # Or Local Development:
   # NEXT_PUBLIC_API_URL=http://localhost:5000/api
   # API_BASE_URL=http://localhost:5000/api

   NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=false
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_API_TIMEOUT=15000
   ```
2. Restart the Next.js dev server:
   ```bash
   npm run dev
   ```
3. Authenticate with seeded credentials:
   - **Email:** `admin@worksphere.com`
   - **Password:** `Admin@WorkSphere2026!`

---

## 📜 License

This project is licensed under the **ISC License**.
