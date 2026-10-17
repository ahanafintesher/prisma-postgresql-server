# WorkSphere EMS & Super Admin Backend — Complete API Endpoints Documentation

> **Gateway Version:** `1.0.0`  
> **Runtime Environment:** Node.js Express / Vercel Serverless  
> **Database:** PostgreSQL (Neon Serverless) via Prisma ORM 7.9  
> **Base URLs:**
> - **Production Gateway:** `https://admin.worksphere.com`
> - **Direct Local Dev:** `http://localhost:5000` (or `http://localhost:3000` via proxy)
> - **CORS Supported Origins:** `http://localhost:3000`, `http://localhost:3001`, `https://admin.worksphere.com`

---

## Table of Contents

1. [Architecture & Route Mounting Prefixes](#1-architecture--route-mounting-prefixes)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Standard Response Envelope & Error Codes](#3-standard-response-envelope--error-codes)
4. [System & Telemetry Endpoints](#4-system--telemetry-endpoints)
5. [Authentication Endpoints (`/auth`)](#5-authentication-endpoints-auth)
6. [Dashboard & Platform Telemetry Endpoints (`/dashboard`)](#6-dashboard--platform-telemetry-endpoints-dashboard)
7. [Tenant Companies Endpoints (`/companies`)](#7-tenant-companies-endpoints-companies)
8. [Subscriptions & Plans Endpoints (`/subscriptions`, `/plans`)](#8-subscriptions--plans-endpoints-subscriptions-plans)
9. [Payments & Finance Endpoints (`/payments`, `/promotions`)](#9-payments--finance-endpoints-payments-promotions)
10. [Support Desk & Announcements Endpoints (`/support`, `/tickets`, `/announcements`)](#10-support-desk--announcements-endpoints-support-tickets-announcements)
11. [Platform Admin Operators (`/admin-users`, `/users`)](#11-platform-admin-operators-admin-users-users)
12. [Roles & Granular Permissions RBAC (`/roles`)](#12-roles--granular-permissions-rbac-roles)
13. [Platform Settings & System Telemetry (`/settings`, `/system-health`, `/jobs`, `/webhooks`, `/integrations`)](#13-platform-settings--system-telemetry-settings-system-health-jobs-webhooks-integrations)
14. [Audit Logs & Governance Endpoints (`/logs`, `/audit-logs`)](#14-audit-logs--governance-endpoints-logs-audit-logs)
15. [OpenClaw Gateway & Dashboard Integration](#15-openclaw-gateway--dashboard-integration)
16. [Redis Caching Architecture & Policies](#16-redis-caching-architecture--policies)
17. [Frontend Integration & Environment Variables Guide](#17-frontend-integration--environment-variables-guide)
    - 17.1 [Frontend Environment Variables Specification (`.env.local` / `.env.production`)](#171-frontend-environment-variables-specification)
    - 17.2 [Backend Gateway Environment Variables (`.env`)](#172-backend-gateway-environment-variables)
    - 17.3 [Cross-Origin Resource Sharing (CORS) Configuration](#173-cross-origin-resource-sharing-cors-configuration)
    - 17.4 [Next.js Client & Server Actions Connection Recipes (`lib/api-client.ts`, `lib/actions/*`)](#174-nextjs-client--server-actions-connection-recipes)
    - 17.5 [Authentication & Token Rotation Lifecycle](#175-authentication--token-rotation-lifecycle)
    - 17.6 [Frontend Action Module to Backend Endpoint Directory](#176-frontend-action-module-to-backend-endpoint-directory)
    - 17.7 [Connectivity Verification & Troubleshooting Guide](#177-connectivity-verification--troubleshooting-guide)

---

## 1. Architecture & Route Mounting Prefixes

The Express router [`src/routes/index.ts`](file:///l:/postgresql-prisma-server/src/routes/index.ts) mounts every resource across three URL conventions to ensure seamless compatibility with Next.js frontends, legacy clients, and versioned enterprise clients:

| Prefix Tier | Route Base Pattern | Target Client & Use Case |
| :--- | :--- | :--- |
| **Direct Routes** | `/{service}/*` | Direct cross-origin matching [`BACKEND_INTEGRATION.md`](file:///l:/postgresql-prisma-server/docs/BACKEND_INTEGRATION.md) (`NEXT_PUBLIC_API_URL`) |
| **API Prefix** | `/api/{service}/*` | Reverse-proxy mode and standard REST API clients |
| **Versioned Super Admin** | `/api/v1/super-admin/{service}/*` | Enterprise Super Admin portal matching [`requirements-final.md`](file:///l:/postgresql-prisma-server/requirements-final.md) |

*(All three prefix variants map to the identical controller logic and middleware chains).*

---

## 2. Authentication & Authorization

### 2.1 JWT Bearer Token
Protected endpoints require an `Authorization` header containing an active JWT token:
```http
Authorization: Bearer <access_token>
```
Access tokens expire after **1 hour**. Refresh tokens expire after **7 days**.

### 2.2 Role-Based Access Control (RBAC) Permissions
Specific write and destructive actions enforce granular platform permissions verified in [`src/middleware/auth.middleware.ts`](file:///l:/postgresql-prisma-server/src/middleware/auth.middleware.ts):
- `platform.companies.manage` — Create companies and assign plans
- `platform.companies.suspend` — Suspend or update company status
- `platform.companies.verify` — Review and approve KYB documentation
- `platform.subscriptions.manage` — Change subscription tiers or extend trials
- `platform.payments.refund` — Issue full or partial payment refunds
- `platform.tickets.reply` — Submit public support ticket replies
- `platform.tickets.notes` — Add internal staff-only ticket notes
- `platform.audit.view` — View immutable audit trail and security logs

---

## 3. Standard Response Envelope & Error Codes

### 3.1 Success Response & Pagination Envelope
All listing and paginated query endpoints return a standardized envelope containing both `pagination` and `meta` (as an alias for Next.js / TanStack Table / UI client compatibility):

```json
{
  "success": true,
  "message": "Operation successful",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

### 3.2 Pagination & Sorting Query Parameters
Every paginated resource endpoint supports the following standard query parameters:

| Parameter | Aliases | Type | Default | Description & Constraints |
| :--- | :--- | :---: | :---: | :--- |
| `page` | `p` | `number` | `1` | 1-indexed target page number (minimum `1`) |
| `limit` | `pageSize`, `per_page`, `size` | `number` | `10` / `20` | Items per page (minimum `1`, capped at `100`) |
| `sortBy` | `sort`, `orderBy` | `string` | `"createdAt"` | Resource field to sort by (e.g. `name`, `amount`, `status`) |
| `sortOrder` | `order`, `dir` | `string` | `"desc"` | Sort direction: `"asc"` (ascending) or `"desc"` (descending) |

#### Example Query:
```http
GET /api/v1/super-admin/companies?page=2&pageSize=10&sortBy=name&sortOrder=asc&status=ACTIVE
```

### 3.3 Error Response
```json
{
  "success": false,
  "error": "Error description message"
}
```

### HTTP Caching Headers (Redis / Resilient Memory)
When calling cached `GET` endpoints, the API gateway returns caching diagnostic headers:
- `X-Cache: HIT` (served immediately from cache) or `X-Cache: MISS` (computed from database and stored)
- `X-Cache-Engine: redis` (when connected to Redis) or `memory` (when operating in resilient in-memory fallback mode)

### Common HTTP Status Codes
| Status | Meaning | Scenario |
| :--- | :--- | :--- |
| `200 OK` | Request Succeeded | Successful read, update, or action |
| `201 Created` | Resource Created | Successfully created company, ticket reply, or session |
| `400 Bad Request` | Validation Error | Missing mandatory fields (e.g. suspension reason) |
| `401 Unauthorized` | Auth Failure | Invalid JWT, expired token, or bad credentials |
| `403 Forbidden` | Permission Denied | Missing RBAC permission or suspended account |
| `404 Not Found` | Entity Missing | Company, ticket, subscription, or payment ID not found |
| `409 Conflict` | Uniqueness Conflict | Company slug or email already registered |
| `500 Server Error` | Internal Failure | Unhandled database or runtime exception |

---

## 4. System & Telemetry Endpoints

### 4.1 System Health
- **Method:** `GET`
- **Paths:** `/health`
- **Auth:** Public
- **Description:** Returns live heartbeat status, service identifier, current ISO timestamp, and Redis cache engine health telemetry.
- **Controller:** [`src/app.ts`](file:///l:/postgresql-prisma-server/src/app.ts#L48-L57)

#### Response (200 OK)
```json
{
  "status": "ok",
  "service": "worksphere-backend",
  "timestamp": "2026-10-17T12:00:00.000Z",
  "redis": {
    "status": "connected",
    "engine": "redis",
    "latencyMs": 2,
    "memoryKeysCount": 0,
    "url": "redis://127.0.0.1:6379"
  }
}
```
*(Note: If a remote or local Redis instance is offline, `"status": "fallback_memory"` and `"engine": "memory"` are reported gracefully without crashing or degrading HTTP response delivery).*


---

### 4.2 Gateway Root & API Explorer
- **Method:** `GET`
- **Paths:** `/`, `/api`
- **Auth:** Public
- **Description:** 
  - If header `Accept: application/json` is provided, returns JSON service metadata and core endpoints catalog.
  - If requested via a browser (`text/html`), renders an interactive dark-mode Status Dashboard and API Explorer with live latency ping testing.
- **Controller:** [`src/routes/root.ts`](file:///l:/postgresql-prisma-server/src/routes/root.ts)

#### JSON Response (`Accept: application/json`)
```json
{
  "name": "WorkSphere EMS - Super Admin API",
  "status": "operational",
  "version": "1.0.0",
  "environment": "production",
  "cloud": "Vercel Serverless",
  "database": "PostgreSQL (Neon Connected)",
  "timestamp": "2026-10-17T12:00:00.000Z",
  "endpoints": { ... }
}
```

---

## 5. Authentication Endpoints (`/auth`)

Controller: [`src/services/auth/auth.controller.ts`](file:///l:/postgresql-prisma-server/src/services/auth/auth.controller.ts)  
Routes: [`src/services/auth/auth.routes.ts`](file:///l:/postgresql-prisma-server/src/services/auth/auth.routes.ts)

### 5.1 Admin Login
- **Method:** `POST`
- **Paths:**
  - `/auth/login`
  - `/api/auth/login`
  - `/api/v1/super-admin/auth/login`
- **Auth:** Public
- **Description:** Authenticates platform administrators using email and bcrypt password. Enforces account suspension checks. If MFA is enabled (`mfaEnabled: true`), returns a 2FA challenge response with a temporary token. Upon successful validation, issues a 1-hour access token, a 7-day refresh token, registers a session record in `PlatformAdminSession`, updates `lastLoginAt`/`lastLoginIp`, and writes an immutable `ADMIN_LOGIN` entry in `AuditLog`.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | Administrator's registered email address |
| `password` | `string` | Yes | Plaintext password |

```json
{
  "email": "admin@worksphere.com",
  "password": "SuperSecretPassword123!"
}
```

#### Response (200 OK — Standard Login)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "c1f2a3b4-5678-90ab-cdef-1234567890ab",
      "name": "Sarah Connor",
      "email": "admin@worksphere.com",
      "role": "Super Administrator",
      "roleSlug": "super-admin",
      "permissions": [
        "platform.companies.manage",
        "platform.companies.suspend",
        "platform.companies.verify",
        "platform.subscriptions.manage",
        "platform.payments.refund",
        "platform.tickets.reply",
        "platform.tickets.notes",
        "platform.audit.view"
      ]
    }
  }
}
```

#### Response (200 OK — 2FA Required)
```json
{
  "success": true,
  "message": "2FA verification required",
  "data": {
    "requires2FA": true,
    "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 5.2 Refresh Access Token
- **Method:** `POST`
- **Paths:**
  - `/auth/refresh`
  - `/api/auth/refresh`
  - `/api/v1/super-admin/auth/refresh`
- **Auth:** Public (requires valid refresh token in body)
- **Description:** Verifies an active 7-day refresh token and issues a fresh 1-hour JWT access token without forcing the user to log in again. Verifies that the admin user has not been suspended.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `refreshToken` | `string` | Yes | Current refresh token |

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 5.3 Get Current Admin Profile
- **Method:** `GET`
- **Paths:**
  - `/auth/me`
  - `/api/auth/me`
  - `/api/v1/super-admin/auth/me`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Returns profile data, avatar URL, 2FA status, last login timestamp, and permissions list for the authenticated administrator.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "c1f2a3b4-5678-90ab-cdef-1234567890ab",
    "name": "Sarah Connor",
    "email": "admin@worksphere.com",
    "role": "Super Administrator",
    "roleSlug": "super-admin",
    "avatarUrl": "https://assets.worksphere.com/avatars/admin.png",
    "mfaEnabled": false,
    "lastLoginAt": "2026-10-17T11:45:00.000Z",
    "permissions": [
      "platform.companies.manage",
      "platform.companies.suspend",
      "platform.companies.verify",
      "platform.subscriptions.manage",
      "platform.payments.refund",
      "platform.tickets.reply",
      "platform.tickets.notes",
      "platform.audit.view"
    ]
  }
}
```

---

### 5.4 Logout
- **Method:** `POST`
- **Paths:**
  - `/auth/logout`
  - `/api/auth/logout`
  - `/api/v1/super-admin/auth/logout`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Invalidates all active sessions belonging to the authenticated administrator by setting `revokedAt = new Date()` in the database.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## 6. Dashboard & Platform Telemetry Endpoints (`/dashboard`)

Controller: [`src/services/dashboard/dashboard.controller.ts`](file:///l:/postgresql-prisma-server/src/services/dashboard/dashboard.controller.ts)  
Routes: [`src/services/dashboard/dashboard.routes.ts`](file:///l:/postgresql-prisma-server/src/services/dashboard/dashboard.routes.ts)

### 6.1 Platform Metrics & KPIs
- **Method:** `GET`
- **Paths:**
  - `/dashboard/metrics` (alias: `/dashboard/summary`)
  - `/api/dashboard/metrics` (alias: `/api/dashboard/summary`)
  - `/api/v1/super-admin/dashboard/metrics`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Asynchronously aggregates core multi-tenant platform KPIs including total companies, active/suspended distribution, pending KYB verification count, total revenue in both dollars and raw cents, open helpdesk tickets, active subscriptions, uptime percentage, and active nodes.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "totalCompanies": 42,
    "activeCompanies": 38,
    "suspendedCompanies": 2,
    "pendingVerifications": 2,
    "totalRevenue": 154200,
    "totalRevenueCents": 15420000,
    "openSupportTickets": 7,
    "activeSubscriptions": 39,
    "platformUptimePercentage": 99.98,
    "activeNodes": 4
  }
}
```

---

### 6.2 Platform Activity Feed
- **Method:** `GET`
- **Paths:**
  - `/dashboard/activity`
  - `/api/dashboard/activity`
  - `/api/v1/super-admin/dashboard/activity`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Returns the 15 most recent immutable audit log activities across all tenants, ordered descending by creation timestamp.

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "log-001",
      "actorId": "admin-uuid",
      "actorEmail": "admin@worksphere.com",
      "actorRole": "super-admin",
      "action": "COMPANY_VERIFIED",
      "resourceType": "COMPANY",
      "resourceId": "company-uuid",
      "reason": "KYB documentation verified",
      "outcome": "SUCCESS",
      "createdAt": "2026-10-17T11:50:00.000Z"
    }
  ]
}
```

---

### 6.3 Platform Registration & Revenue Charts (6-Month Trends)
- **Method:** `GET`
- **Paths:**
  - `/dashboard/charts`
  - `/api/dashboard/charts`
  - `/api/v1/super-admin/dashboard/charts`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **60 seconds** (`worksphere:dashboard:/charts:{}`)
- **Description:** Aggregates rolling 6-month historical time-series analytics on new company registrations and gross revenue across the platform. Formats currency units in standard dollars and exact integer minor units (cents).

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "month": "May",
      "year": 2026,
      "label": "May 2026",
      "companiesRegistered": 4,
      "revenue": 14200,
      "revenueCents": 1420000
    },
    {
      "month": "Jun",
      "year": 2026,
      "label": "Jun 2026",
      "companiesRegistered": 6,
      "revenue": 21800,
      "revenueCents": 2180000
    },
    {
      "month": "Oct",
      "year": 2026,
      "label": "Oct 2026",
      "companiesRegistered": 12,
      "revenue": 45600,
      "revenueCents": 4560000
    }
  ]
}
```

---

## 7. Tenant Companies Endpoints (`/companies`)

Controller: [`src/services/companies/company.controller.ts`](file:///l:/postgresql-prisma-server/src/services/companies/company.controller.ts)  
Routes: [`src/services/companies/company.routes.ts`](file:///l:/postgresql-prisma-server/src/services/companies/company.routes.ts)

### 7.1 List Companies
- **Method:** `GET`
- **Paths:**
  - `/companies`
  - `/api/companies`
  - `/api/v1/super-admin/companies`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Paginated directory of tenant companies with support for multi-field search and status filtering. Includes active subscription plan name and aggregated counts of support tickets and payments.

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `10` | Records per page (maximum: 100) |
| `search` | `string` | `""` | Case-insensitive search on `name`, `slug`, or `ownerEmail` |
| `status` | `string` | `ALL` | Filter by `ACTIVE`, `SUSPENDED`, `PENDING`, `ARCHIVED`, or `ALL` |
| `verificationStatus` | `string` | `ALL` | Filter by `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`, or `ALL` |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
      "name": "Acme Innovations Ltd",
      "slug": "acme-innovations",
      "ownerEmail": "ceo@acmeinnovations.com",
      "status": "ACTIVE",
      "verificationStatus": "VERIFIED",
      "verifiedAt": "2026-08-15T09:30:00.000Z",
      "suspensionReason": null,
      "activePlan": "Enterprise Scale",
      "createdAt": "2026-01-10T08:00:00.000Z",
      "ticketCount": 4,
      "paymentCount": 18
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

### 7.2 Get Company by ID
- **Method:** `GET`
- **Paths:**
  - `/companies/:id`
  - `/api/companies/:id`
  - `/api/v1/super-admin/companies/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Returns full company profile including complete subscription plan history, recent 10 payments, and recent 5 support tickets.

#### Route Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Yes | Target company ID |

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
    "name": "Acme Innovations Ltd",
    "slug": "acme-innovations",
    "ownerEmail": "ceo@acmeinnovations.com",
    "status": "ACTIVE",
    "verificationStatus": "VERIFIED",
    "subscriptions": [
      {
        "id": "sub-1",
        "status": "ACTIVE",
        "billingInterval": "MONTHLY",
        "currentPeriodStart": "2026-10-01T00:00:00.000Z",
        "currentPeriodEnd": "2026-11-01T00:00:00.000Z",
        "planVersion": {
          "id": "v-1",
          "version": 2,
          "plan": {
            "name": "Enterprise Scale",
            "monthlyPrice": 29900
          }
        }
      }
    ],
    "payments": [ ... ],
    "supportTickets": [ ... ]
  }
}
```

---

### 7.3 Create Tenant Company
- **Method:** `POST`
- **Paths:**
  - `/companies`
  - `/api/companies`
  - `/api/v1/super-admin/companies`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.companies.manage`
- **Description:** Provisions a new tenant company. Ensures slug uniqueness. Optionally assigns an initial subscription package (30-day billing period). Automatically writes an immutable audit log entry.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | Legal organization name |
| `slug` | `string` | Yes | Unique URL-friendly slug identifier |
| `ownerEmail` | `string` | Yes | Primary tenant owner email address |
| `initialPlanId` | `UUID` | No | Optional Plan ID to provision initial subscription |

```json
{
  "name": "Apex Cybernetics",
  "slug": "apex-cybernetics",
  "ownerEmail": "admin@apexcyber.io",
  "initialPlanId": "plan-growth-uuid"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Company created successfully",
  "data": {
    "id": "99a8b7c6-5432-10fe-dcba-0987654321fe",
    "name": "Apex Cybernetics",
    "slug": "apex-cybernetics",
    "ownerEmail": "admin@apexcyber.io",
    "status": "ACTIVE",
    "verificationStatus": "UNVERIFIED",
    "createdAt": "2026-10-17T12:00:00.000Z",
    "updatedAt": "2026-10-17T12:00:00.000Z"
  }
}
```

---

### 7.4 Update Company Operational Status
- **Method:** `PATCH`
- **Paths:**
  - `/companies/:id/status` (alias: `POST /companies/:id/suspend`)
  - `/api/companies/:id/status`
  - `/api/v1/super-admin/companies/:id/status`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.companies.suspend`
- **Description:** Updates company status (`ACTIVE`, `SUSPENDED`, `PENDING`, `ARCHIVED`). **Compliance Rule AC-05:** If `status` is set to `SUSPENDED`, a documented `reason` string is mandatory. Sets `suspendedAt` and records state changes in the audit trail.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `status` | `string` | Yes | `ACTIVE`, `SUSPENDED`, `ARCHIVED`, or `PENDING` |
| `reason` | `string` | Required if `SUSPENDED` | Documented reason explaining the operational status change |

```json
{
  "status": "SUSPENDED",
  "reason": "Repeated failed payment attempts and ToS violation report"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Company status updated to SUSPENDED",
  "data": {
    "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
    "status": "SUSPENDED",
    "suspensionReason": "Repeated failed payment attempts and ToS violation report",
    "suspendedAt": "2026-10-17T12:05:00.000Z"
  }
}
```

---

### 7.5 Verify Company (KYB Compliance)
- **Method:** `POST`
- **Paths:**
  - `/companies/:id/verify`
  - `/api/companies/:id/verify`
  - `/api/v1/super-admin/companies/:id/verify`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.companies.verify`
- **Description:** Reviews and resolves Know-Your-Business (KYB) compliance status. Updates verification status to `VERIFIED` (if approved) or `REJECTED` (if not). Records reviewer ID and reason in audit trail.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `approved` | `boolean` | Yes | `true` to approve (`VERIFIED`), `false` to reject (`REJECTED`) |
| `rejectionReason` | `string` | No | Explanation if rejected |

```json
{
  "approved": true,
  "rejectionReason": null
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Company verification status set to VERIFIED",
  "data": {
    "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
    "verificationStatus": "VERIFIED",
    "verifiedAt": "2026-10-17T12:06:00.000Z"
  }
}
```

---

### 7.6 Update Company Platform Metadata
- **Method:** `PATCH`
- **Paths:**
  - `/companies/:id`
  - `/api/companies/:id`
  - `/api/v1/super-admin/companies/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.companies.manage`
- **Description:** Updates tenant company name, owner email, unique URL slug, and verification document references. Validates slug collisions and logs an immutable audit event.

#### Request Body
```json
{
  "name": "Apex Cybernetics Corp",
  "ownerEmail": "founders@apexcyber.io"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Company updated successfully",
  "data": {
    "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
    "name": "Apex Cybernetics Corp",
    "slug": "apex-cybernetics",
    "ownerEmail": "founders@apexcyber.io",
    "updatedAt": "2026-10-17T12:20:00.000Z"
  }
}
```

---

### 7.7 Reactivate Suspended Company
- **Method:** `POST`
- **Paths:**
  - `/companies/:id/reactivate`
  - `/api/companies/:id/reactivate`
  - `/api/v1/super-admin/companies/:id/reactivate`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.companies.suspend`
- **Description:** Restores full platform access to a suspended tenant company. Clears `suspensionReason` and `suspendedAt`, sets `status: ACTIVE`, and writes an audit record.

#### Request Body
```json
{
  "reason": "Payment issue resolved; compliance verified"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Company reactivated successfully",
  "data": {
    "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
    "status": "ACTIVE",
    "suspensionReason": null,
    "suspendedAt": null
  }
}
```

---

### 7.8 Reject Company Verification (KYB)
- **Method:** `POST`
- **Paths:**
  - `/companies/:id/reject`
  - `/api/companies/:id/reject`
  - `/api/v1/super-admin/companies/:id/reject`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.companies.verify`
- **Description:** Dedicated endpoint to reject KYB registration documentation with an operator reason note. Sets `verificationStatus: REJECTED`.

#### Request Body
```json
{
  "reason": "Provided trade license expired; illegible tax ID certificate"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Company verification rejected",
  "data": {
    "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
    "verificationStatus": "REJECTED",
    "verifiedAt": null
  }
}
```

---

### 7.9 Archive / Soft-Delete Company
- **Method:** `DELETE`
- **Paths:**
  - `/companies/:id`
  - `/api/companies/:id`
  - `/api/v1/super-admin/companies/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.companies.manage`
- **Description:** Deprovisions a tenant company safely. Per AC-05 data preservation standards, sets `status: ARCHIVED` while retaining historical billing, audit, and employee records for regulatory compliance.

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Company archived successfully",
  "data": {
    "id": "e4b1c2d3-4567-890a-bcde-f1234567890a",
    "status": "ARCHIVED"
  }
}
```

---

## 8. Subscriptions & Plans Endpoints (`/subscriptions`, `/plans`)

Controller: [`src/services/subscriptions/subscription.controller.ts`](file:///l:/postgresql-prisma-server/src/services/subscriptions/subscription.controller.ts)  
Routes: [`src/services/subscriptions/subscription.routes.ts`](file:///l:/postgresql-prisma-server/src/services/subscriptions/subscription.routes.ts)

### 8.1 List Pricing Plans
- **Method:** `GET`
- **Paths:**
  - `/subscriptions/plans` (alias: `/plans`)
  - `/api/subscriptions/plans`
  - `/api/v1/super-admin/plans`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Retrieves all active SaaS subscription pricing plans, their latest active version metadata, feature configuration flags, and monthly/annual pricing.

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "plan-starter",
      "name": "Starter",
      "slug": "starter",
      "monthlyPrice": 4900,
      "annualPrice": 49000,
      "isActive": true,
      "versions": [
        {
          "id": "ver-starter-v1",
          "version": 1,
          "features": { "maxEmployees": 25, "payroll": false, "basicReports": true },
          "isActive": true
        }
      ]
    },
    {
      "id": "plan-growth",
      "name": "Growth Pro",
      "slug": "growth-pro",
      "monthlyPrice": 14900,
      "annualPrice": 149000,
      "isActive": true,
      "versions": [
        {
          "id": "ver-growth-v2",
          "version": 2,
          "features": { "maxEmployees": 150, "payroll": true, "advancedReports": true },
          "isActive": true
        }
      ]
    }
  ]
}
```

---

### 8.2 List Subscriptions
- **Method:** `GET`
- **Paths:**
  - `/subscriptions`
  - `/api/subscriptions`
  - `/api/v1/super-admin/subscriptions`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Paginated list of active and past subscriptions across all tenant companies, including linked company summaries and pricing plan versions.

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `10` | Records per page |
| `status` | `string` | `ALL` | `ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELLED`, `EXPIRED`, or `ALL` |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "sub-uuid-1",
      "companyId": "comp-uuid-1",
      "status": "ACTIVE",
      "billingInterval": "MONTHLY",
      "currentPeriodStart": "2026-10-01T00:00:00.000Z",
      "currentPeriodEnd": "2026-11-01T00:00:00.000Z",
      "company": {
        "id": "comp-uuid-1",
        "name": "Acme Innovations Ltd",
        "slug": "acme-innovations",
        "ownerEmail": "ceo@acmeinnovations.com",
        "status": "ACTIVE"
      },
      "planVersion": {
        "id": "ver-growth-v2",
        "version": 2,
        "plan": {
          "id": "plan-growth",
          "name": "Growth Pro",
          "slug": "growth-pro"
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 39,
    "totalPages": 4
  }
}
```

---

### 8.3 Change Subscription Plan
- **Method:** `POST`
- **Paths:**
  - `/subscriptions/:id/change-plan`
  - `/api/subscriptions/:id/change-plan`
  - `/api/v1/super-admin/subscriptions/:id/change-plan`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.subscriptions.manage`
- **Description:** Upgrades or downgrades a tenant's subscription to a new target plan version, and optionally updates the billing interval (`MONTHLY` / `ANNUAL`). Records an immutable audit log detailing previous and new plan specifications.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `newPlanVersionId` | `UUID` | Yes | Target `PlanVersion` identifier |
| `billingInterval` | `string` | No | Optional interval: `MONTHLY` or `ANNUAL` |

```json
{
  "newPlanVersionId": "ver-growth-v2",
  "billingInterval": "ANNUAL"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Subscription plan updated successfully",
  "data": {
    "id": "sub-uuid-1",
    "planVersionId": "ver-growth-v2",
    "billingInterval": "ANNUAL",
    "status": "ACTIVE"
  }
}
```

---

### 8.4 Extend Subscription Trial
- **Method:** `POST`
- **Paths:**
  - `/subscriptions/:id/extend-trial`
  - `/api/subscriptions/:id/extend-trial`
  - `/api/v1/super-admin/subscriptions/:id/extend-trial`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.subscriptions.manage`
- **Description:** Extends trial expiration date by a specified number of days (defaults to 14 days) and sets subscription status to `TRIALING`.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `additionalDays` | `integer` | No | Number of additional trial days (Default: `14`) |

```json
{
  "additionalDays": 30
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Trial extended by 30 days",
  "data": {
    "id": "sub-uuid-1",
    "status": "TRIALING",
    "trialEndsAt": "2026-11-16T12:00:00.000Z"
  }
}
```

---

### 8.5 Create Pricing Plan Tier
- **Method:** `POST`
- **Paths:**
  - `/subscriptions/plans` (alias: `/plans`)
  - `/api/subscriptions/plans` (alias: `/api/plans`)
  - `/api/v1/super-admin/plans`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.plans.manage`
- **Description:** Provisions a new SaaS pricing tier in `plans` and automatically creates its initial version (`version: 1`) in `plan_versions`.

#### Request Body
```json
{
  "name": "Enterprise Plus",
  "slug": "enterprise-plus",
  "description": "Custom SLA, unlimited employees, dedicated infrastructure",
  "monthlyPrice": 39900,
  "annualPrice": 399000,
  "currency": "USD",
  "maxEmployees": 500,
  "maxProjects": 200,
  "features": ["payroll", "advanced-analytics", "sso-saml", "dedicated-support"]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Plan created successfully",
  "data": {
    "id": "plan-uuid-enterprise",
    "name": "Enterprise Plus",
    "slug": "enterprise-plus",
    "monthlyPrice": 39900,
    "annualPrice": 399000,
    "isActive": true
  }
}
```

---

### 8.6 Update Pricing Plan Parameters
- **Method:** `PATCH` / `PUT`
- **Paths:**
  - `/subscriptions/plans/:id` (alias: `/plans/:id`)
  - `/api/subscriptions/plans/:id` (alias: `/api/plans/:id`)
  - `/api/v1/super-admin/plans/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.plans.manage`
- **Description:** Updates pricing tier attributes, features list, seat limits, or active status. If pricing or limits are modified, snapshots the new specifications into an incremented `plan_versions` record.

#### Request Body
```json
{
  "monthlyPrice": 42900,
  "maxEmployees": 600,
  "isActive": true
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Plan updated successfully",
  "data": {
    "id": "plan-uuid-enterprise",
    "monthlyPrice": 42900,
    "maxEmployees": 600,
    "isActive": true
  }
}
```

---

### 8.7 Cancel Tenant Subscription
- **Method:** `POST`
- **Paths:**
  - `/subscriptions/:id/cancel`
  - `/api/subscriptions/:id/cancel`
  - `/api/v1/super-admin/subscriptions/:id/cancel`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.subscriptions.manage`
- **Description:** Terminates an active subscription. Updates status to `CANCELLED`, records `cancelledAt` timestamp, writes an immutable audit record, and invalidates cached dashboard revenue metrics.

#### Request Body
```json
{
  "reason": "Customer voluntary cancellation following company downsizing"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "data": {
    "id": "sub-uuid-1",
    "status": "CANCELLED",
    "cancelledAt": "2026-10-17T12:30:00.000Z"
  }
}
```

---

## 9. Payments & Finance Endpoints (`/payments`, `/promotions`)

Controller: [`src/services/payments/payment.controller.ts`](file:///l:/postgresql-prisma-server/src/services/payments/payment.controller.ts)  
Routes: [`src/services/payments/payment.routes.ts`](file:///l:/postgresql-prisma-server/src/services/payments/payment.routes.ts)

### 9.1 List Payments & Invoices
- **Method:** `GET`
- **Paths:**
  - `/payments`
  - `/api/payments`
  - `/api/v1/super-admin/payments`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Returns paginated transactions and invoices with multi-field search and gateway filtering. Amount is provided in standard currency units (dollars) and exact integer cents.

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `10` | Records per page (maximum: 100) |
| `search` | `string` | `""` | Search on `transactionRef`, `idempotencyKey`, or company name |
| `status` | `string` | `ALL` | `SUCCEEDED`, `PENDING`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`, or `ALL` |
| `gateway` | `string` | `ALL` | `STRIPE`, `SSLCOMMERZ`, `BKASH`, or `ALL` |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "pay-uuid-001",
      "companyName": "Acme Innovations Ltd",
      "companySlug": "acme-innovations",
      "companyId": "comp-uuid-1",
      "gateway": "STRIPE",
      "amount": 299,
      "amountCents": 29900,
      "currency": "USD",
      "status": "SUCCEEDED",
      "transactionRef": "ch_3NabcXYZ12345",
      "idempotencyKey": "idem_comp1_period10",
      "refundedAmount": 0,
      "refundReason": null,
      "createdAt": "2026-10-01T00:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 128,
    "totalPages": 13
  }
}
```

---

### 9.2 Get Payment by ID
- **Method:** `GET`
- **Paths:**
  - `/payments/:id`
  - `/api/payments/:id`
  - `/api/v1/super-admin/payments/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Retrieves detailed transaction receipt including linked tenant company details and subscription plan version.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "pay-uuid-001",
    "amount": 29900,
    "currency": "USD",
    "gateway": "STRIPE",
    "status": "SUCCEEDED",
    "company": {
      "id": "comp-uuid-1",
      "name": "Acme Innovations Ltd"
    },
    "subscription": {
      "id": "sub-uuid-1",
      "planVersion": {
        "plan": { "name": "Enterprise Scale" }
      }
    }
  }
}
```

---

### 9.3 Process Payment Refund
- **Method:** `POST`
- **Paths:**
  - `/payments/:id/refund`
  - `/api/payments/:id/refund`
  - `/api/v1/super-admin/payments/:id/refund`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.payments.refund`
- **Description:** Issues a full or partial refund for a successful transaction. Enforces mandatory documented reason. Automatically updates status to `REFUNDED` or `PARTIALLY_REFUNDED`, tracks accumulated `refundedAmount`, and logs an immutable audit entry.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `reason` | `string` | Yes | Mandatory audit justification for the refund |
| `refundAmount` | `number` | No | Optional partial refund amount in standard units (e.g. `49.00`). If omitted, refunds total available balance. |

```json
{
  "reason": "Customer billing credit for mid-month downgrade",
  "refundAmount": 49.00
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "id": "pay-uuid-001",
    "status": "PARTIALLY_REFUNDED",
    "refundReason": "Customer billing credit for mid-month downgrade",
    "refundedAmount": 4900
  }
}
```

---

### 9.4 Reconcile Gateway Payment State
- **Method:** `POST`
- **Paths:**
  - `/payments/:id/reconcile`
  - `/api/payments/:id/reconcile`
  - `/api/v1/super-admin/payments/:id/reconcile`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.payments.manage`
- **Description:** Cryptographically polls and synchronizes payment state from gateway webhooks or direct gateway APIs. Resolves `PENDING` states to `SUCCEEDED` or `FAILED`, updates `capturedAt` timestamp, and writes an audit event.

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Payment reconciled successfully",
  "data": {
    "id": "pay-uuid-001",
    "status": "SUCCEEDED",
    "capturedAt": "2026-10-17T12:35:00.000Z"
  }
}
```

---

### 9.5 List Promotions & Coupon Codes
- **Method:** `GET`
- **Paths:**
  - `/promotions` (alias: `/payments/promotions`)
  - `/api/promotions`
  - `/api/v1/super-admin/promotions`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **60 seconds** (`worksphere:promotions:/:{params}`)
- **Description:** Paginated catalog of promotional discounts, coupon codes, redemption counters, and expiration dates.

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `10` | Records per page |
| `search` | `string` | `""` | Search in coupon code or description |
| `isActive` | `boolean` | Optional | Filter by active availability |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "promo-uuid-01",
      "code": "LAUNCH2026",
      "description": "Super Admin launch discount — 20% off all tiers",
      "discountType": "PERCENTAGE",
      "discountValue": 20,
      "validFrom": "2026-10-01T00:00:00.000Z",
      "validUntil": "2026-12-31T23:59:59.000Z",
      "maxRedemptions": 500,
      "timesRedeemed": 42,
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 9.6 Create Promotional Discount Coupon
- **Method:** `POST`
- **Paths:**
  - `/promotions` (alias: `/payments/promotions`)
  - `/api/promotions`
  - `/api/v1/super-admin/promotions`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.payments.manage`
- **Description:** Creates a promotion coupon. Enforces unique coupon codes and writes an immutable audit record.

#### Request Body
```json
{
  "code": "AUTUMN50",
  "description": "Autumn flash sale fixed discount",
  "discountType": "FIXED_AMOUNT",
  "discountValue": 5000,
  "validUntil": "2026-11-30T23:59:59.000Z",
  "maxRedemptions": 100
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Promotion created successfully",
  "data": {
    "id": "promo-uuid-02",
    "code": "AUTUMN50",
    "discountType": "FIXED_AMOUNT",
    "discountValue": 5000,
    "isActive": true
  }
}
```

---

### 9.7 Update Promotion
- **Method:** `PATCH`
- **Paths:**
  - `/promotions/:id`
  - `/api/promotions/:id`
  - `/api/v1/super-admin/promotions/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.payments.manage`
- **Description:** Updates coupon active status, description, or redemption cap.

---

### 9.8 Delete Promotion
- **Method:** `DELETE`
- **Paths:**
  - `/promotions/:id`
  - `/api/promotions/:id`
  - `/api/v1/super-admin/promotions/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.payments.manage`
- **Description:** Permanently deletes a promotional coupon code.

---

## 10. Support Desk & Announcements Endpoints (`/support`, `/tickets`, `/announcements`)

Controller: [`src/services/support/support.controller.ts`](file:///l:/postgresql-prisma-server/src/services/support/support.controller.ts)  
Routes: [`src/services/support/support.routes.ts`](file:///l:/postgresql-prisma-server/src/services/support/support.routes.ts)

### 10.1 List Support Tickets
- **Method:** `GET`
- **Paths:**
  - `/support/tickets` (alias: `/tickets`)
  - `/api/support/tickets`
  - `/api/v1/super-admin/tickets`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Paginated customer tickets with multi-field search and filtering by status and priority. Returns SLA breach flag, assigned admin name, and total message counts.

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `10` | Records per page (maximum: 100) |
| `search` | `string` | `""` | Search in `subject`, `requesterEmail`, or company name |
| `status` | `string` | `ALL` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, or `ALL` |
| `priority` | `string` | `ALL` | `LOW`, `MEDIUM`, `HIGH`, `URGENT`, or `ALL` |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "ticket-uuid-001",
      "subject": "Need assistance integrating SSO SAML",
      "companyName": "Acme Innovations Ltd",
      "companySlug": "acme-innovations",
      "companyId": "comp-uuid-1",
      "priority": "HIGH",
      "status": "OPEN",
      "requesterEmail": "techlead@acmeinnovations.com",
      "assignedAdmin": "Sarah Connor",
      "slaBreached": false,
      "messageCount": 3,
      "createdAt": "2026-10-17T09:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 14,
    "totalPages": 2
  }
}
```

---

### 10.2 Get Support Ticket by ID
- **Method:** `GET`
- **Paths:**
  - `/support/tickets/:id`
  - `/api/support/tickets/:id`
  - `/api/v1/super-admin/tickets/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Retrieves complete support ticket thread ordered chronologically, including customer messages, public replies, internal private notes, and attachments.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "ticket-uuid-001",
    "subject": "Need assistance integrating SSO SAML",
    "priority": "HIGH",
    "status": "OPEN",
    "company": {
      "id": "comp-uuid-1",
      "name": "Acme Innovations Ltd"
    },
    "assignedAdmin": {
      "id": "admin-uuid",
      "name": "Sarah Connor",
      "email": "admin@worksphere.com"
    },
    "messages": [
      {
        "id": "msg-1",
        "authorId": "tenant-user-uuid",
        "authorRole": "TENANT_ADMIN",
        "isInternalNote": false,
        "messageBody": "We are attempting to configure Okta SSO but receiving cert mismatch.",
        "attachments": ["https://cdn.worksphere.com/files/okta-error.png"],
        "createdAt": "2026-10-17T09:15:00.000Z"
      }
    ]
  }
}
```

---

### 10.3 Add Public Reply to Ticket
- **Method:** `POST`
- **Paths:**
  - `/support/tickets/:id/replies`
  - `/api/support/tickets/:id/replies`
  - `/api/v1/super-admin/tickets/:id/replies`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.tickets.reply`
- **Description:** Appends an official customer-facing response to a ticket thread. Updates ticket `updatedAt` timestamp.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `messageBody` | `string` | Yes | Content of the reply |
| `attachments` | `array of strings` | No | URLs of uploaded attachments |

```json
{
  "messageBody": "Please ensure you have imported our latest x509 public certificate from your portal.",
  "attachments": ["https://cdn.worksphere.com/certs/worksphere-saml-2026.crt"]
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Message posted successfully",
  "data": {
    "id": "msg-reply-002",
    "ticketId": "ticket-uuid-001",
    "authorRole": "Super Administrator",
    "isInternalNote": false,
    "messageBody": "Please ensure you have imported our latest x509 public certificate from your portal.",
    "attachments": ["https://cdn.worksphere.com/certs/worksphere-saml-2026.crt"],
    "createdAt": "2026-10-17T12:10:00.000Z"
  }
}
```

---

### 10.4 Add Internal Staff Note
- **Method:** `POST`
- **Paths:**
  - `/support/tickets/:id/notes`
  - `/api/support/tickets/:id/notes`
  - `/api/v1/super-admin/tickets/:id/notes`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.tickets.notes`
- **Description:** Adds an internal administrative note (`isInternalNote: true`) visible only to platform staff.

#### Request Body
```json
{
  "messageBody": "Customer is on Enterprise Tier. Tier 2 engineering is inspecting the SAML handshake.",
  "isInternalNote": true
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Message posted successfully",
  "data": {
    "id": "msg-note-003",
    "ticketId": "ticket-uuid-001",
    "isInternalNote": true,
    "messageBody": "Customer is on Enterprise Tier. Tier 2 engineering is inspecting the SAML handshake.",
    "createdAt": "2026-10-17T12:11:00.000Z"
  }
}
```

---

### 10.5 Update Ticket Status & Assignment
- **Method:** `PATCH`
- **Paths:**
  - `/support/tickets/:id/status`
  - `/api/support/tickets/:id/status`
  - `/api/v1/super-admin/tickets/:id/status`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Updates ticket resolution status (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), priority level, or reassigns ownership to another platform administrator.

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `status` | `string` | No | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `priority` | `string` | No | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| `assignedAdminId` | `UUID` | No | ID of administrator assigned to handle ticket |

```json
{
  "status": "RESOLVED",
  "priority": "HIGH",
  "assignedAdminId": "admin-uuid"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Ticket updated successfully",
  "data": {
    "id": "ticket-uuid-001",
    "status": "RESOLVED",
    "priority": "HIGH",
    "assignedAdminId": "admin-uuid"
  }
}
```

---

### 10.6 Reassign Ticket Operator
- **Method:** `POST`
- **Paths:**
  - `/support/tickets/:id/assign`
  - `/api/support/tickets/:id/assign`
  - `/api/v1/super-admin/tickets/:id/assign`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.tickets.assign`
- **Description:** Reassigns ticket ownership to another platform operator. Writes an audit log record and invalidates ticket caches.

#### Request Body
```json
{
  "assignedAdminId": "admin-uuid-02"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Ticket assigned to John Doe",
  "data": {
    "id": "ticket-uuid-001",
    "assignedAdminId": "admin-uuid-02"
  }
}
```

---

### 10.7 List Platform Announcements
- **Method:** `GET`
- **Paths:**
  - `/announcements` (alias: `/support/announcements`)
  - `/api/announcements`
  - `/api/v1/super-admin/announcements`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **30 seconds** (`worksphere:announcements:/:{params}`)
- **Description:** Returns paginated system broadcasts with filtering by `type` (`INFO`, `WARNING`, `MAINTENANCE`, `CRITICAL`), publication status, and target audience.

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "ann-uuid-1",
      "title": "Scheduled Maintenance Window",
      "content": "Database upgrades scheduled for Sunday 02:00 UTC",
      "type": "MAINTENANCE",
      "targetAudience": "ALL",
      "isPublished": true,
      "publishedAt": "2026-10-15T00:00:00.000Z",
      "expiresAt": "2026-10-19T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 10.8 Broadcast System Announcement
- **Method:** `POST`
- **Paths:**
  - `/announcements` (alias: `/support/announcements`)
  - `/api/announcements`
  - `/api/v1/super-admin/announcements`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.announcements.manage`
- **Description:** Creates and optionally publishes a system broadcast banner across tenant portals.

#### Request Body
```json
{
  "title": "Critical Security Patch Deployed",
  "content": "All tenant authentication tokens have been rotated for enhanced security.",
  "type": "WARNING",
  "targetAudience": "ALL",
  "isPublished": true,
  "expiresAt": "2026-10-25T23:59:59.000Z"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Announcement created successfully",
  "data": {
    "id": "ann-uuid-2",
    "title": "Critical Security Patch Deployed",
    "type": "WARNING",
    "isPublished": true,
    "publishedAt": "2026-10-17T12:40:00.000Z"
  }
}
```

---

### 10.9 Update Announcement
- **Method:** `PATCH`
- **Paths:**
  - `/announcements/:id`
  - `/api/announcements/:id`
  - `/api/v1/super-admin/announcements/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.announcements.manage`
- **Description:** Updates broadcast title, body, status, or expiration.

---

### 10.10 Delete Announcement
- **Method:** `DELETE`
- **Paths:**
  - `/announcements/:id`
  - `/api/announcements/:id`
  - `/api/v1/super-admin/announcements/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.announcements.manage`
- **Description:** Removes a broadcast announcement.

---

## 11. Platform Admin Operators (`/admin-users`, `/users`)

Controller: [`src/services/admin-users/admin-users.controller.ts`](file:///l:/postgresql-prisma-server/src/services/admin-users/admin-users.controller.ts)  
Routes: [`src/services/admin-users/admin-users.routes.ts`](file:///l:/postgresql-prisma-server/src/services/admin-users/admin-users.routes.ts)

### 11.1 List Platform Admin Users
- **Method:** `GET`
- **Paths:**
  - `/admin-users` (alias: `/users`)
  - `/api/admin-users` (alias: `/api/users`)
  - `/api/v1/super-admin/admin-users` (alias: `/api/v1/super-admin/users`)
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **30 seconds** (`worksphere:admin_users:/:{params}`)
- **Description:** Paginated listing of platform operators with attached RBAC role metadata. Passwords and MFA secrets are strictly redacted.

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "admin-uuid-01",
      "name": "Platform Root Administrator",
      "email": "admin@worksphere.com",
      "status": "ACTIVE",
      "avatarUrl": null,
      "roleId": "role-root-uuid",
      "mfaEnabled": false,
      "lastLoginAt": "2026-10-17T12:00:00.000Z",
      "role": {
        "id": "role-root-uuid",
        "name": "Super Administrator (Root)",
        "slug": "super-admin-root"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

---

### 11.2 Get Admin User by ID
- **Method:** `GET`
- **Paths:**
  - `/admin-users/:id` (alias: `/users/:id`)
  - `/api/admin-users/:id`
  - `/api/v1/super-admin/admin-users/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Retrieves detailed operator profile including granular permissions granted by role.

---

### 11.3 Create / Invite Platform Admin
- **Method:** `POST`
- **Paths:**
  - `/admin-users` (alias: `/users`)
  - `/api/admin-users`
  - `/api/v1/super-admin/admin-users`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.admins.manage`
- **Description:** Provisions a new platform administrative operator with bcrypt-hashed credentials and assigned role.

#### Request Body
```json
{
  "name": "Alex Mercer",
  "email": "alex.mercer@worksphere.com",
  "password": "SecurePassword2026!",
  "roleId": "role-support-lead-uuid"
}
```

#### Response (201 Created)
```json
{
  "success": true,
  "message": "Admin user created successfully",
  "data": {
    "id": "admin-uuid-02",
    "name": "Alex Mercer",
    "email": "alex.mercer@worksphere.com",
    "status": "ACTIVE",
    "role": { "name": "Support Lead", "slug": "support-lead" }
  }
}
```

---

### 11.4 Update Platform Admin
- **Method:** `PATCH`
- **Paths:**
  - `/admin-users/:id` (alias: `/users/:id`)
  - `/api/admin-users/:id`
  - `/api/v1/super-admin/admin-users/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.admins.manage`
- **Description:** Updates name, email, or role assignment.

---

### 11.5 Update Admin Status (Suspend / Reactivate)
- **Method:** `PATCH`
- **Paths:**
  - `/admin-users/:id/status` (alias: `/users/:id/status`)
  - `/api/admin-users/:id/status`
  - `/api/v1/super-admin/admin-users/:id/status`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.admins.manage`
- **Description:** Updates status to `ACTIVE` or `SUSPENDED`. Safeguards prevent suspending the root Super Admin account or self-suspension.

---

### 11.6 Delete Platform Admin
- **Method:** `DELETE`
- **Paths:**
  - `/admin-users/:id` (alias: `/users/:id`)
  - `/api/admin-users/:id`
  - `/api/v1/super-admin/admin-users/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.admins.manage`
- **Description:** Revokes active sessions and deletes administrator account. Root account is protected from deletion.

---

## 12. Roles & Granular Permissions RBAC (`/roles`)

Controller: [`src/services/roles/roles.controller.ts`](file:///l:/postgresql-prisma-server/src/services/roles/roles.controller.ts)  
Routes: [`src/services/roles/roles.routes.ts`](file:///l:/postgresql-prisma-server/src/services/roles/roles.routes.ts)

### 12.1 List Roles & Assigned Counts
- **Method:** `GET`
- **Paths:**
  - `/roles`
  - `/api/roles`
  - `/api/v1/super-admin/roles`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **60 seconds** (`worksphere:roles:/:{}`)
- **Description:** Returns all predefined system roles and custom administrative roles along with operator counts and permission keys.

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "role-root-uuid",
      "name": "Super Administrator (Root)",
      "slug": "super-admin-root",
      "description": "Full unmetered platform control",
      "isSystem": true,
      "adminCount": 1,
      "permissions": ["platform.companies.manage", "platform.subscriptions.manage", "..."]
    }
  ]
}
```

---

### 12.2 Get Role by ID
- **Method:** `GET`
- **Paths:**
  - `/roles/:id`
  - `/api/roles/:id`
  - `/api/v1/super-admin/roles/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Detailed view of role with permissions breakdown.

---

### 12.3 Create Custom Role
- **Method:** `POST`
- **Paths:**
  - `/roles`
  - `/api/roles`
  - `/api/v1/super-admin/roles`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.roles.manage`
- **Description:** Creates custom RBAC role and binds permission keys.

#### Request Body
```json
{
  "name": "Billing Auditor",
  "slug": "billing-auditor",
  "description": "Read-only access to transactions, subscriptions, and financial logs",
  "permissions": ["platform.payments.refund", "platform.audit.view"]
}
```

---

### 12.4 Update Role Permissions
- **Method:** `PATCH`
- **Paths:**
  - `/roles/:id`
  - `/api/roles/:id`
  - `/api/v1/super-admin/roles/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.roles.manage`
- **Description:** Updates role metadata and updates permission junction records.

---

### 12.5 Delete Role
- **Method:** `DELETE`
- **Paths:**
  - `/roles/:id`
  - `/api/roles/:id`
  - `/api/v1/super-admin/roles/:id`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.roles.manage`
- **Description:** Deletes custom role. System roles and roles with active assigned administrators cannot be deleted.

---

### 12.6 List Available System Permissions
- **Method:** `GET`
- **Paths:**
  - `/roles/permissions`
  - `/api/roles/permissions`
  - `/api/v1/super-admin/roles/permissions`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **5 minutes (300s)** (`worksphere:roles:/permissions:{}`)
- **Description:** Catalogs all system permission keys categorized by platform domain (`Companies`, `Subscriptions`, `Payments`, `Support`, `Governance`, `Settings`).

---

## 13. Platform Settings & System Telemetry (`/settings`, `/system-health`, `/jobs`, `/webhooks`, `/integrations`)

Controller: [`src/services/settings/settings.controller.ts`](file:///l:/postgresql-prisma-server/src/services/settings/settings.controller.ts)  
Routes: [`src/services/settings/settings.routes.ts`](file:///l:/postgresql-prisma-server/src/services/settings/settings.routes.ts)

### 13.1 List Platform Settings
- **Method:** `GET`
- **Paths:**
  - `/settings`
  - `/api/settings`
  - `/api/v1/super-admin/settings`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **60 seconds** (`worksphere:settings:/:{}`)
- **Description:** Returns global configuration key-value pairs from `system_settings`. AC-12 compliant: Secret keys and credentials are automatically masked (`********`).

---

### 13.2 Batch Update Platform Settings
- **Method:** `PATCH`
- **Paths:**
  - `/settings`
  - `/api/settings`
  - `/api/v1/super-admin/settings`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.settings.manage`
- **Description:** Upserts key-value pairs in platform configuration and invalidates settings cache.

#### Request Body
```json
{
  "settings": {
    "maintenance_mode": false,
    "default_trial_days": 14,
    "support_sla_hours": 24
  }
}
```

---

### 13.3 Real-Time Infrastructure Health & Telemetry
- **Method:** `GET`
- **Paths:**
  - `/system-health`
  - `/api/system-health`
  - `/api/v1/super-admin/system-health`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Cache Policy:** Cached for **10 seconds** (`worksphere:health:/system-health:{}`)
- **Description:** Evaluates platform health across compute nodes, PostgreSQL query latency, Redis cache connectivity, and BullMQ worker queues.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "status": "OPERATIONAL",
    "uptimeSeconds": 2480,
    "nodes": [
      {
        "nodeId": "node-primary-01",
        "region": "ap-southeast-1",
        "status": "HEALTHY",
        "memory": { "rssMb": 105, "heapUsedMb": 52 }
      }
    ],
    "services": {
      "database": { "status": "HEALTHY", "engine": "PostgreSQL (Neon Serverless)", "latencyMs": 45 },
      "cache": { "status": "HEALTHY", "engine": "memory", "fallbackKeys": 12 },
      "queue": { "status": "HEALTHY", "engine": "BullMQ (Redis)" }
    }
  }
}
```

---

### 13.4 Background Worker Queue Telemetry
- **Method:** `GET`
- **Paths:**
  - `/api/v1/super-admin/jobs`
  - `/jobs`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Returns BullMQ queue counters: active, completed, failed, delayed, and waiting jobs.

---

### 13.5 Retry Failed Background Job
- **Method:** `POST`
- **Paths:**
  - `/api/v1/super-admin/jobs/:id/retry`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.settings.manage`
- **Description:** Re-queues a failed background task and writes an audit log.

---

### 13.6 Outbound Webhooks Delivery Logs
- **Method:** `GET`
- **Paths:**
  - `/api/v1/super-admin/webhooks`
  - `/webhooks`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Logs delivery status, HTTP status codes, and replay counts for outbound events.

---

### 13.7 Third-Party Integrations Health
- **Method:** `GET`
- **Paths:**
  - `/api/v1/super-admin/integrations`
  - `/integrations`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Description:** Returns integration status for Stripe, SSLCommerz, bKash, SendGrid, and AWS S3 with masked credentials.

---

### 13.8 Test Third-Party Integration Diagnostic
- **Method:** `POST`
- **Paths:**
  - `/api/v1/super-admin/integrations/:id/test`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.settings.manage`
- **Description:** Executes live diagnostic ping against specified integration service.

---

### 13.9 Update Platform Security Policy
- **Method:** `PATCH`
- **Paths:**
  - `/api/v1/super-admin/security-policy`
  - `/security-policy`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.settings.manage`
- **Description:** Governs platform-wide MFA enforcement, session timeout limits, and IP allowlists.

---

## 14. Audit Logs & Governance Endpoints (`/logs`, `/audit-logs`)

Controller: [`src/services/audit/audit.controller.ts`](file:///l:/postgresql-prisma-server/src/services/audit/audit.controller.ts)  
Routes: [`src/services/audit/audit.routes.ts`](file:///l:/postgresql-prisma-server/src/services/audit/audit.routes.ts)

### 14.1 List Audit Trail Records
- **Method:** `GET`
- **Paths:**
  - `/logs` (alias: `/audit-logs`)
  - `/api/logs`
  - `/api/v1/super-admin/audit-logs`
- **Auth:** Authenticated (`Bearer <access_token>`)
- **Required Permission:** `platform.audit.view`
- **Description:** Queries the platform's immutable audit log for compliance reviews, security tracking, and administrative accountability. Supports pagination, full-text search across actor email, action name, reason, and resource ID, and filtering by `resourceType` and `action`.

#### Query Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `integer` | `1` | Page number |
| `limit` | `integer` | `20` | Records per page (maximum: 100) |
| `search` | `string` | `""` | Search on `actorEmail`, `action`, `reason`, or `resourceId` |
| `resourceType` | `string` | `ALL` | `COMPANY`, `SUBSCRIPTION`, `PAYMENT`, `AUTH`, or `ALL` |
| `action` | `string` | `ALL` | Specific action name (e.g. `COMPANY_SUSPENDED`, `PAYMENT_REFUNDED`) or `ALL` |

#### Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "id": "audit-uuid-099",
      "actorId": "c1f2a3b4-5678-90ab-cdef-1234567890ab",
      "actorEmail": "admin@worksphere.com",
      "actorRole": "super-admin",
      "action": "PAYMENT_REFUNDED",
      "resourceType": "PAYMENT",
      "resourceId": "pay-uuid-001",
      "reason": "Customer billing credit for mid-month downgrade",
      "changes": {
        "refundAmountCents": 4900,
        "previousStatus": "SUCCEEDED",
        "newStatus": "PARTIALLY_REFUNDED"
      },
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0 ...",
      "outcome": "SUCCESS",
      "createdAt": "2026-10-17T12:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 342,
    "totalPages": 18
  }
}
```

---

## 15. OpenClaw Gateway & Dashboard Integration

The platform includes local integration with the self-hosted **OpenClaw AI Gateway** (`openclaw`) running on port `18789`:

- **Gateway URL:** `http://127.0.0.1:18789/`
- **WebSocket URL:** `ws://127.0.0.1:18789/`
- **Control UI / Dashboard URL:**
  ```http
  http://127.0.0.1:18789/#token=b2e107eb8b35fa8ec98abd2547e27e98fa53661abcbb7944
  ```
- **CLI Commands to launch:**
  ```bash
  # Launch the Control UI in default browser
  openclaw dashboard
  ```

---

## 16. Redis Caching Architecture & Policies

The platform integrates a high-performance, fault-tolerant caching layer implemented in [`src/lib/redis.ts`](file:///l:/postgresql-prisma-server/src/lib/redis.ts) and Express route middleware in [`src/middleware/cache.middleware.ts`](file:///l:/postgresql-prisma-server/src/middleware/cache.middleware.ts).

### 16.1 Architecture & Fail-Safe Resilience

```mermaid
graph TD
  Req[Incoming HTTP GET Request] --> CacheCheck{Check Cache Layer}
  CacheCheck -- "Cache Hit" --> ReturnHit["Return Cached JSON (X-Cache: HIT)"]
  CacheCheck -- "Cache Miss" --> DBQuery[Execute Database / Prisma Query]
  DBQuery --> AsyncSet["Async Cache Write (Non-blocking)"]
  AsyncSet --> ReturnMiss["Return Fresh Response (X-Cache: MISS)"]

  subgraph Engine [Storage Engine]
    RedisStore[(Live Redis Server)] -. "If Offline / Unreachable" .-> MemoryFallback[(TTL In-Memory Fallback)]
  end

  AsyncSet -.-> Engine
  CacheCheck -.-> Engine
```

- **Primary Engine:** High-speed Redis instance via `ioredis` supporting connection pooling, TLS (`rediss://`), Sentinel, or Managed Cloud Redis (Upstash, AWS ElastiCache, Redis Cloud).
- **Graceful Degradation:** If the Redis instance is unavailable, experiencing connection delays, or not configured in local development:
  - The server **does NOT crash or block HTTP requests**.
  - It automatically routes operations to an internal TTL **In-Memory Store**.
  - Reconnects automatically with exponential backoff when Redis is restored.

---

### 16.2 Environment Variables & Configuration

Configure Redis connection settings in `.env`:

```env
# Connection String (supports redis://, rediss://, with authentication and ports)
REDIS_URL="redis://127.0.0.1:6379"

# Master Cache Switch ("true" to enable, "false" to bypass)
REDIS_CACHE_ENABLED="true"
```

| Provider | Sample `REDIS_URL` Format |
| :--- | :--- |
| **Local Redis** | `redis://127.0.0.1:6379` |
| **Redis with Password** | `redis://:mysecretpassword@127.0.0.1:6379` |
| **Upstash (Serverless)** | `rediss://default:token@ep-hostname.upstash.io:6379` |
| **AWS ElastiCache** | `rediss://cluster-name.cache.amazonaws.com:6379` |
| **Redis Cloud** | `redis://default:password@redis-12345.c10.us-east-1-2.ec2.redislabs.com:12345` |

---

### 16.3 Diagnostic Caching Headers

Every cached `GET` endpoint returns headers indicating the cache state and the underlying engine:

```http
X-Cache: HIT
X-Cache-Engine: redis
```

| Header | Possible Values | Meaning |
| :--- | :--- | :--- |
| `X-Cache` | `HIT` | The payload was served directly from cache without hitting PostgreSQL. |
| `X-Cache` | `MISS` | The payload was queried from PostgreSQL and asynchronously stored in cache. |
| `X-Cache-Engine` | `redis` | Served by active Redis server. |
| `X-Cache-Engine` | `memory` | Served by the resilient local memory fallback store. |

---

### 16.4 Caching TTL Policy Table

| Service / Domain | Route | Default TTL | Cache Key Pattern |
| :--- | :--- | :--- | :--- |
| **Dashboard** | `GET /dashboard/metrics` | **30 seconds** | `worksphere:dashboard:/metrics:{}` |
| **Dashboard** | `GET /dashboard/summary` | **30 seconds** | `worksphere:dashboard:/summary:{}` |
| **Dashboard** | `GET /dashboard/activity` | **15 seconds** | `worksphere:dashboard:/activity:{}` |
| **Dashboard** | `GET /dashboard/charts` | **60 seconds** | `worksphere:dashboard:/charts:{}` |
| **Companies** | `GET /companies` | **30 seconds** | `worksphere:companies:/:{params}` |
| **Companies** | `GET /companies/:id` | **60 seconds** | `worksphere:companies:/:id:{}` |
| **Subscriptions** | `GET /subscriptions/plans` | **5 minutes (300s)** | `worksphere:plans:/plans:{}` |
| **Subscriptions** | `GET /subscriptions` | **30 seconds** | `worksphere:subscriptions:/:{params}` |
| **Payments** | `GET /payments` | **30 seconds** | `worksphere:payments:/:{params}` |
| **Payments** | `GET /payments/:id` | **60 seconds** | `worksphere:payments:/:id:{}` |
| **Promotions** | `GET /promotions` | **60 seconds** | `worksphere:promotions:/:{params}` |
| **Support** | `GET /support/tickets` | **15 seconds** | `worksphere:tickets:/tickets:{params}` |
| **Support** | `GET /support/tickets/:id`| **30 seconds** | `worksphere:tickets:/tickets/:id:{}` |
| **Announcements** | `GET /announcements` | **30 seconds** | `worksphere:announcements:/:{params}` |
| **Platform Admins** | `GET /admin-users` | **30 seconds** | `worksphere:admin_users:/:{params}` |
| **Platform Admins** | `GET /admin-users/:id` | **60 seconds** | `worksphere:admin_users:/:id:{}` |
| **Roles & RBAC** | `GET /roles` | **60 seconds** | `worksphere:roles:/:{}` |
| **Roles & RBAC** | `GET /roles/permissions`| **5 minutes (300s)** | `worksphere:roles:/permissions:{}` |
| **Settings** | `GET /settings` | **60 seconds** | `worksphere:settings:/:{}` |
| **Telemetry** | `GET /system-health` | **10 seconds** | `worksphere:health:/system-health:{}` |
| **Audit Logs** | `GET /logs` | **15 seconds** | `worksphere:audit:/:{params}` |

*(Query strings like `?page=1&status=ACTIVE` are serialized into the cache key to guarantee accurate, isolated caching for different filter combinations).*

---

### 16.5 Automatic Cache Invalidation Triggers

When platform state is modified, the backend automatically purges all related cached records using pattern-based matching:

| Mutating Action | Endpoint | Invalidated Cache Categories | Keys Cleared |
| :--- | :--- | :--- | :--- |
| **Create Company** | `POST /companies` | `companies`, `dashboard` | `worksphere:companies:*`, `worksphere:dashboard:*` |
| **Update Company Metadata** | `PATCH /companies/:id` | `companies`, `dashboard` | `worksphere:companies:*`, `worksphere:dashboard:*` |
| **Update Company Status** | `PATCH /companies/:id/status` | `companies`, `dashboard` | `worksphere:companies:*`, `worksphere:dashboard:*` |
| **Verify / Reject Company**| `POST /companies/:id/verify`, `POST /:id/reject` | `companies`, `dashboard` | `worksphere:companies:*`, `worksphere:dashboard:*` |
| **Reactivate Company** | `POST /companies/:id/reactivate` | `companies`, `dashboard` | `worksphere:companies:*`, `worksphere:dashboard:*` |
| **Delete / Archive Company** | `DELETE /companies/:id` | `companies`, `dashboard` | `worksphere:companies:*`, `worksphere:dashboard:*` |
| **Create / Update Plan** | `POST /plans`, `PATCH /plans/:id` | `plans`, `dashboard` | `worksphere:plans:*`, `worksphere:dashboard:*` |
| **Change Subscription Plan**| `POST /subscriptions/:id/change-plan` | `subscriptions`, `dashboard` | `worksphere:subscriptions:*`, `worksphere:dashboard:*` |
| **Extend Subscription Trial** | `POST /subscriptions/:id/extend-trial` | `subscriptions`, `dashboard` | `worksphere:subscriptions:*`, `worksphere:dashboard:*` |
| **Cancel Subscription** | `POST /subscriptions/:id/cancel` | `subscriptions`, `dashboard` | `worksphere:subscriptions:*`, `worksphere:dashboard:*` |
| **Issue Payment Refund** | `POST /payments/:id/refund` | `payments`, `dashboard` | `worksphere:payments:*`, `worksphere:dashboard:*` |
| **Reconcile Payment** | `POST /payments/:id/reconcile` | `payments`, `dashboard` | `worksphere:payments:*`, `worksphere:dashboard:*` |
| **Create / Edit Promotion** | `POST /promotions`, `PATCH /promotions/:id` | `promotions`, `payments` | `worksphere:promotions:*`, `worksphere:payments:*` |
| **Reply to Support Ticket** | `POST /support/tickets/:id/replies` | `tickets`, `dashboard` | `worksphere:tickets:*`, `worksphere:dashboard:*` |
| **Add Ticket Note** | `POST /support/tickets/:id/notes` | `tickets`, `dashboard` | `worksphere:tickets:*`, `worksphere:dashboard:*` |
| **Update / Assign Ticket** | `PATCH /support/tickets/:id`, `POST /:id/assign` | `tickets`, `dashboard` | `worksphere:tickets:*`, `worksphere:dashboard:*` |
| **Broadcast Announcement** | `POST /announcements`, `PATCH /:id` | `announcements` | `worksphere:announcements:*` |
| **Admin Operator CRUD** | `POST /admin-users`, `PATCH /:id`, `DELETE /:id`| `admin_users` | `worksphere:admin_users:*` |
| **Role & Permissions CRUD** | `POST /roles`, `PATCH /roles/:id` | `roles` | `worksphere:roles:*` |
| **Update System Settings** | `PATCH /settings` | `settings` | `worksphere:settings:*` |

---

### 16.6 Cache Key Namespace Convention

All cache keys adhere to the structured namespace:
```
worksphere:<category>:<path>:<query_params_hash>
```

#### Programmatic Cache Management
The backend exposes utility methods in [`src/lib/redis.ts`](file:///l:/postgresql-prisma-server/src/lib/redis.ts) for manual cache control:
```typescript
import {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  invalidateCacheCategory,
  getOrSetCache,
  getRedisHealth
} from "./lib/redis";

// Invalidate all company and dashboard keys
await invalidateCacheCategory("companies");
await invalidateCacheCategory("dashboard");

// Purge all WorkSphere keys
await invalidateCacheCategory("all");
```

---

### 16.7 Telemetry & Health Monitoring

The live `/health` endpoint exposes real-time Redis telemetry:

```http
GET /health
```

#### Connected to Redis
```json
{
  "status": "ok",
  "service": "worksphere-backend",
  "timestamp": "2026-10-17T12:00:00.000Z",
  "redis": {
    "status": "connected",
    "engine": "redis",
    "latencyMs": 2,
    "memoryKeysCount": 0,
    "url": "redis://127.0.0.1:6379"
  }
}
```

#### Operating in Resilient Memory Fallback
```json
{
  "status": "ok",
  "service": "worksphere-backend",
  "timestamp": "2026-10-17T12:00:00.000Z",
  "redis": {
    "status": "fallback_memory",
    "engine": "memory",
    "memoryKeysCount": 12,
    "url": "redis://127.0.0.1:6379"
  }
}
```

---

## 17. Frontend Integration & Environment Variables Guide

This section provides the end-to-end integration specifications, environment variable configuration, and connection recipes for connecting the Next.js (App Router) Super Admin portal (`ems-admin`) to this Express.js + Prisma backend gateway.

A companion ready-to-copy configuration template is also provided at [`.env.frontend.example`](file:///l:/postgresql-prisma-server/.env.frontend.example).

---

### 17.1 Frontend Environment Variables Specification

The frontend portal (`ems-admin`) reads configuration from `.env.local` during local development and `.env.production` in production builds.

#### Variable Reference Catalog

| Variable Name | Required | Default Value (Dev) | Description |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | **Yes** | `http://localhost:5000/api` | Base URL used by browser-side client requests (fetch, SWR, TanStack Query, Axios). |
| `API_BASE_URL` | **Yes** | `http://localhost:5000/api` | Base URL used by server-side Next.js code (Server Actions, Server Components, Route Handlers). In Docker/K8s networks, can point to internal container name. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `http://localhost:3000` | Public origin of the Next.js portal (used for redirect URLs, invitation links, callback routing). |
| `NEXT_PUBLIC_WS_URL` | No | `ws://localhost:5000` | WebSocket gateway URL for real-time announcements, toast broadcasts, and queue telemetry. |
| `NEXT_PUBLIC_ENABLE_MOCK_FALLBACK` | No | `false` | When `false`, all UI actions call the live backend gateway. When `true`, falls back to `lib/mock-data.ts` if the backend is unreachable. |
| `NEXT_PUBLIC_API_TIMEOUT` | No | `15000` | Maximum HTTP request timeout in milliseconds before triggering network timeout exceptions. |

#### Complete Copy-Paste Configuration for Frontend (`ems-admin/.env.local`)

Create or update `.env.local` in your Next.js application root:

```env
# =============================================================================
# WorkSphere EMS Super Admin (ems-admin) — Local Development Environment
# Save this file as: ems-admin/.env.local
# =============================================================================

# 1. Client-Side API Gateway Base URL
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# 2. Server-Side Next.js Actions API Base URL
API_BASE_URL=http://localhost:5000/api

# 3. Application Public Origin
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 4. WebSocket Gateway
NEXT_PUBLIC_WS_URL=ws://localhost:5000

# 5. Offline Fallback Control (false = live backend enforced)
NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=false

# 6. Request Timeout (ms)
NEXT_PUBLIC_API_TIMEOUT=15000
```

#### Production Configuration (`ems-admin/.env.production`)

```env
# =============================================================================
# WorkSphere EMS Super Admin (ems-admin) — Production Deployment
# Save this file as: ems-admin/.env.production (or configure in Vercel / Cloud Run)
# =============================================================================

NEXT_PUBLIC_API_URL=https://admin.worksphere.com/api
API_BASE_URL=https://admin.worksphere.com/api
NEXT_PUBLIC_APP_URL=https://admin.worksphere.com
NEXT_PUBLIC_WS_URL=wss://admin.worksphere.com
NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=false
NEXT_PUBLIC_API_TIMEOUT=30000
```

---

### 17.2 Backend Gateway Environment Variables

The Express backend reads settings from [`.env`](file:///l:/postgresql-prisma-server/.env) in the root of `postgresql-prisma-server`:

```env
# =============================================================================
# WorkSphere EMS Platform Backend — Environment Variables (.env)
# =============================================================================

# 1. PostgreSQL Database Connection (Neon Serverless with SSL)
DATABASE_URL="postgresql://neondb_owner:npg_V64MkysxFnIh@ep-frosty-wind-b3slc3cg-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# 2. JWT Secret Key (HMAC SHA-256 for Access & Refresh Tokens)
JWT_SECRET="7882a5f0e9cc387e199b42d426718201291fdaa11a963ddb1c73970bf4b35b4e86b9835facad5eb3ddcb136d33bbf7f354dffd0a9eb34bc64018cb239771e8fb"

# 3. Server Port
PORT=5000

# 4. Node Environment
NODE_ENV="development"

# 5. Redis Distributed Caching (Auto-fails over to memory if offline)
REDIS_URL="redis://127.0.0.1:6379"
REDIS_CACHE_ENABLED="true"

# 6. Allowed Frontend Origins (Comma-separated)
FRONTEND_URL="http://localhost:3000,http://localhost:3001,https://admin.worksphere.com"
```

---

### 17.3 Cross-Origin Resource Sharing (CORS) Configuration

The backend gateway [`src/app.ts`](file:///l:/postgresql-prisma-server/src/app.ts) is preconfigured with CORS support:

- **Allowed Origins:**
  - `http://localhost:3000` (Next.js default dev port)
  - `http://localhost:3001` (Alternative local dev port)
  - `https://admin.worksphere.com` (Production domain)
  - Any origin specified in `FRONTEND_URL` or `CORS_ORIGIN` env variables
  - Any local development port matching `http://localhost:*`
- **Supported Methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- **Supported Headers:** `Content-Type`, `Authorization`, `Accept`, `X-Refresh-Token`, `X-Requested-With`
- **Credentials Support:** `credentials: true` (supports cookies and authorization headers in cross-origin requests).

---

### 17.4 Next.js Client & Server Actions Connection Recipes

#### A. Centralized API Client (`lib/api-client.ts`)

```typescript
// lib/api-client.ts
const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  message?: string;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("worksphere_token")
    : null;

  // Normalize path
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(json.error || `HTTP ${res.status}: Request failed`);
  }

  return json;
}
```

#### B. Next.js Server Actions Recipe (`lib/actions/*.ts`)

```typescript
// Example: lib/actions/companies.ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const BACKEND_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function getAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// 1. Fetch Companies
export async function getCompanies(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);
  if (params?.status && params.status !== "ALL") query.set("status", params.status);

  const authHeaders = await getAuthHeader();
  const res = await fetch(`${BACKEND_URL}/companies?${query.toString()}`, {
    headers: { ...authHeaders, "Content-Type": "application/json" },
    next: { revalidate: 30 }, // ISR Cache for 30s
  });

  return await res.json();
}

// 2. Suspend Company (Mutating Action)
export async function suspendCompany(companyId: string, reason: string) {
  const authHeaders = await getAuthHeader();
  const res = await fetch(`${BACKEND_URL}/companies/${companyId}/suspend`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });

  const json = await res.json();
  if (json.success) {
    revalidatePath("/companies");
    revalidatePath("/dashboard");
  }
  return json;
}
```

---

### 17.5 Authentication & Token Rotation Lifecycle

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Super Admin Operator
  participant Next as Next.js Frontend (ems-admin)
  participant API as Express Gateway (:5000)
  participant DB as Neon PostgreSQL

  Admin->>Next: Enters email & password
  Next->>API: POST /api/auth/login { email, password }
  API->>DB: Query admin & verify bcrypt hash
  alt 2FA Enabled
    API-->>Next: 200 OK { requires2FA: true, tempToken }
    Next->>Admin: Show TOTP 6-digit challenge input
    Admin->>Next: Submits 6-digit code
    Next->>API: POST /api/auth/verify-2fa { tempToken, code }
    API->>DB: Verify TOTP secret & log audit entry
  end
  API-->>Next: 200 OK { token (1h), refreshToken (7d), user }
  Next->>Next: Store token in secure cookie / localStorage
  Next->>Admin: Redirect to Dashboard (/dashboard)

  loop While Session Active
    Next->>API: Authenticated Request with Header "Authorization: Bearer <token>"
    alt Token Expired (401)
      Next->>API: POST /api/auth/refresh { refreshToken }
      API-->>Next: 200 OK { token: newAccessToken, refreshToken }
      Next->>API: Re-try original request with new token
    end
  end

  Admin->>Next: Clicks "Sign Out"
  Next->>API: POST /api/auth/logout
  API->>DB: Revoke session (revokedAt = NOW())
  Next->>Next: Clear cookies & local storage
  Next->>Admin: Redirect to /login
```

---

### 17.6 Frontend Action Module to Backend Endpoint Directory

This cheatsheet maps each Next.js Server Action file in `ems-admin/lib/actions/*.ts` to its exact backend route:

| Frontend Action File | Frontend Function | HTTP Method | Target Backend Route | Description |
| :--- | :--- | :---: | :--- | :--- |
| **`lib/actions/dashboard.ts`** | `getDashboardMetrics()` | `GET` | `/api/dashboard/metrics` | Total counts, active companies, revenue, ticket counts |
| | `getDashboardCharts()` | `GET` | `/api/dashboard/charts` | 6-month monthly revenue & registration trends |
| | `getDashboardActivity()` | `GET` | `/api/dashboard/activity` | Recent 15 platform audit events |
| **`lib/actions/companies.ts`** | `getCompanies(params)` | `GET` | `/api/companies` | Paginated directory with search & status filters |
| | `getCompanyById(id)` | `GET` | `/api/companies/:id` | Full tenant profile with subscription & ticket history |
| | `createCompany(data)` | `POST` | `/api/companies` | Provision new tenant company and default trial |
| | `updateCompany(id, data)` | `PATCH` | `/api/companies/:id` | Edit name, slug, ownerEmail, metadata |
| | `suspendCompany(id, reason)` | `POST` | `/api/companies/:id/suspend` | Suspend company with mandatory reason (**AC-04**) |
| | `reactivateCompany(id, reason)` | `POST` | `/api/companies/:id/reactivate` | Restore company access to `ACTIVE` |
| | `verifyCompany(id, approved)` | `POST` | `/api/companies/:id/verify` | Approve or reject KYB documentation verification |
| | `deleteCompany(id)` | `DELETE` | `/api/companies/:id` | Soft-delete tenant company to `ARCHIVED` status |
| **`lib/actions/subscriptions.ts`** | `getPlans()` | `GET` | `/api/plans` | Active pricing tiers, features, employee limits |
| | `createPlan(data)` | `POST` | `/api/plans` | Create new SaaS pricing plan with versioning |
| | `updatePlan(id, data)` | `PATCH` | `/api/plans/:id` | Update plan limits & prices (creates new version) |
| | `getSubscriptions(params)` | `GET` | `/api/subscriptions` | Paginated list of company active/trial subscriptions |
| | `changeSubscriptionPlan(id, ...)` | `POST` | `/api/subscriptions/:id/change-plan` | Switch company subscription to new plan version |
| | `extendSubscriptionTrial(id, days)` | `POST` | `/api/subscriptions/:id/extend-trial` | Extend trial period by N days |
| | `cancelSubscription(id, reason)` | `POST` | `/api/subscriptions/:id/cancel` | Cancel subscription with audit log |
| **`lib/actions/payments.ts`** | `getPayments(params)` | `GET` | `/api/payments` | Paginated ledger with dollar and cents amounts |
| | `getPaymentById(id)` | `GET` | `/api/payments/:id` | Payment details, breakdown, gateway receipt |
| | `issueRefund(id, reason, amount)` | `POST` | `/api/payments/:id/refund` | Process full or partial refund with mandatory reason |
| | `reconcilePayment(id, status)` | `POST` | `/api/payments/:id/reconcile` | Sync transaction status with gateway |
| | `getPromotions(params)` | `GET` | `/api/promotions` | List promotional discount coupons |
| | `createPromotion(data)` | `POST` | `/api/promotions` | Create discount coupon code |
| | `updatePromotion(id, data)` | `PATCH` | `/api/promotions/:id` | Update coupon validity, max uses, or active state |
| | `deletePromotion(id)` | `DELETE` | `/api/promotions/:id` | Delete promotional discount coupon |
| **`lib/actions/support.ts`** | `getTickets(params)` | `GET` | `/api/tickets` | Support desk tickets with status & priority filters |
| | `getTicketById(id)` | `GET` | `/api/tickets/:id` | Ticket conversation thread & attachments |
| | `replyToTicket(id, body)` | `POST` | `/api/tickets/:id/replies` | Submit public support reply to requester |
| | `addInternalNote(id, body)` | `POST` | `/api/tickets/:id/notes` | Add staff-only internal ticket note |
| | `updateTicketStatus(id, status)` | `PATCH` | `/api/tickets/:id` | Update status (`OPEN`, `IN_PROGRESS`, `RESOLVED`) |
| | `assignTicket(id, adminId)` | `POST` | `/api/tickets/:id/assign` | Reassign ticket operator |
| | `getAnnouncements()` | `GET` | `/api/announcements` | System-wide announcements & active banners |
| | `createAnnouncement(data)` | `POST` | `/api/announcements` | Publish broadcast announcement banner |
| | `deleteAnnouncement(id)` | `DELETE` | `/api/announcements/:id` | Remove broadcast banner |
| **`lib/actions/admin-users.ts`** | `getAdminUsers(params)` | `GET` | `/api/admin-users` | Paginated operators, roles, 2FA status, last login |
| | `createAdminUser(data)` | `POST` | `/api/admin-users` | Invite platform operator with designated role |
| | `updateAdminUser(id, data)` | `PATCH` | `/api/admin-users/:id` | Update operator name, email, or role |
| | `updateAdminStatus(id, status)` | `PATCH` | `/api/admin-users/:id/status` | Suspend or activate operator (self-suspension blocked) |
| | `deleteAdminUser(id)` | `DELETE` | `/api/admin-users/:id` | Delete operator (root Super Admin protected) |
| **`lib/actions/roles.ts`** | `getRoles()` | `GET` | `/api/roles` | System and custom platform roles |
| | `getPermissions()` | `GET` | `/api/roles/permissions` | Granular permission catalog grouped by domain |
| | `createRole(data)` | `POST` | `/api/roles` | Create new custom platform role with permission keys |
| | `updateRole(id, data)` | `PATCH` | `/api/roles/:id` | Update role metadata and assigned permission set |
| | `deleteRole(id)` | `DELETE` | `/api/roles/:id` | Delete custom role (system roles protected) |
| **`lib/actions/settings.ts`** | `getSystemHealth()` | `GET` | `/api/system-health` | Platform host telemetry, CPU load, memory usage |
| | `getHealthServices()` | `GET` | `/api/health/services` | Multi-node infrastructure status (Neon DB, Redis, BullMQ, S3) |
| | `getBackgroundJobs()` | `GET` | `/api/jobs` | BullMQ worker queues (email, billing, kyb) |
| | `retryBackgroundJob(id)` | `POST` | `/api/jobs/:id/retry` | Re-enqueue failed background worker job |
| | `getWebhooks()` | `GET` | `/api/webhooks` | Outbound tenant webhook delivery logs |
| | `getIntegrations()` | `GET` | `/api/integrations` | Diagnostic list of Stripe, SSLCommerz, bKash, SendGrid, S3 |
| | `testIntegration(id)` | `POST` | `/api/integrations/:id/test` | Non-destructive diagnostic ping to external provider |
| | `getPlatformSettings()` | `GET` | `/api/settings` | Platform configuration with automated secret masking |
| | `updatePlatformSettings(data)` | `PATCH` | `/api/settings` | Update configuration keys and values |
| | `getSecurityPolicy()` | `GET` | `/api/security-policy` | Session timeouts, password policy, mandatory 2FA |
| | `updateSecurityPolicy(data)` | `PATCH` | `/api/security-policy` | Update session duration and IP allowlist |
| **`lib/actions/audit.ts`** | `getAuditLogs(params)` | `GET` | `/api/audit-logs` | Immutable audit trail with actor, action, resource filters |
| | `exportAuditLogs(format)` | `GET` | `/api/audit-logs/export?format=json` | Compliance audit download (JSON or CSV format) |

---

### 17.7 Connectivity Verification & Troubleshooting Guide

#### 1. Verifying Gateway Health from Terminal
```bash
# Check basic gateway heartbeat
curl -s http://localhost:5000/health

# Check API prefix health
curl -s http://localhost:5000/api/health

# Check multi-service telemetry
curl -s http://localhost:5000/api/health/services
```

#### 2. Testing Authentication & Token Issue
```bash
curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@worksphere.com","password":"Admin@WorkSphere2026!"}'
```

#### 3. Common Connection Issues & Resolutions

| Issue / Error | Root Cause | Solution |
| :--- | :--- | :--- |
| **`TypeError: fetch failed (ECONNREFUSED)`** | The Express backend is not running on port 5000. | Start the backend with `npm run dev` in `postgresql-prisma-server`. |
| **`CORS error: No 'Access-Control-Allow-Origin'`** | The frontend is running on a port not listed in CORS allowed origins. | By default, all `http://localhost:*` ports are permitted. If deploying to custom domains, add your URL to `FRONTEND_URL` in backend `.env`. |
| **`401 Unauthorized: Access token expired`** | JWT access tokens expire after 1 hour. | Use `POST /api/auth/refresh` with `{ refreshToken }` to obtain a fresh access token without re-prompting credentials. |
| **`403 Forbidden: Missing permission`** | Operator role lacks the required granular permission key for this action. | Assign the permission key to the operator's role via `PATCH /api/roles/:id` or log in as root Super Admin. |
| **`Frontend showing mock data instead of live DB`** | `NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=true` and backend was temporarily unreachable. | Ensure backend is running and set `NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=false` in `ems-admin/.env.local`. |
