# Super Admin Platform — Backend API Specification

Backend requirements for the Super Admin dashboard of a multi-tenant SaaS platform.
This document lists every endpoint the frontend expects, the response format, and implementation notes.

- **Controller modules:** 12
- **Total endpoints:** 81
- **Bearer JWT protected:** 73
- **Non-Bearer (public / refresh token / temp token / signature):** 8

> Note: Earlier drafts listed 78 endpoints. Counting every row in the tables below gives 81 (Profile has 12 instead of 11, and Announcements/Coupons/Integrations has 10 instead of 8).

---

## 1. Suggested Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js (JavaScript, ES Modules) |
| Framework | Express |
| ORM | Prisma |
| Auth | JWT (access + refresh), TOTP 2FA |
| Queue | BullMQ + Redis |
| File storage | S3-compatible |
| Mailer | SMTP / transactional email provider |
| Payments | bKash, SSLCOMMERZ, Stripe (webhooks) |
| Validation | Zod or Joi |

---

## 2. Conventions

- All routes are prefixed with `/api`.
- Auth header: `Authorization: Bearer <accessToken>`
- Content type: `application/json`
- Dates: ISO 8601 (UTC)
- IDs: string (cuid / uuid / ObjectId)
- Pagination query: `?page=1&limit=10`
- Common list filters: `search`, `status`, `from`, `to`

### Success response

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 48,
    "totalPages": 5
  }
}
```

Single resource responses omit `pagination`:

```json
{ "success": true, "data": { } }
```

### Error response

```json
{
  "success": false,
  "message": "Tenant is already suspended.",
  "errors": {
    "status": ["Cannot transition from SUSPENDED to SUSPENDED"]
  }
}
```

### HTTP status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthenticated / token expired |
| 403 | Forbidden (RBAC or protected resource) |
| 404 | Not found |
| 409 | Conflict / invalid state transition |
| 429 | Rate limited |
| 500 | Server error |

---

## 3. Endpoints

Legend for **Auth**: `Bearer` = JWT access token required, `None` = public.

### 3.1 Authentication & Session Management (7)

Base: `/api/auth`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/auth/login` | Authenticate super admin; issues JWT access & refresh tokens | None |
| POST | `/auth/register` | Register new corporate tenant organization | None |
| POST | `/auth/logout` | Invalidate current session and refresh token | Bearer |
| POST | `/auth/refresh` | Issue new access token using refresh token | Refresh token |
| POST | `/auth/verify-2fa` | Complete login challenge with 6-digit TOTP code | Temp token |
| POST | `/auth/forgot-password` | Send password reset link/token to admin email | None |
| POST | `/auth/reset-password` | Set new password using verified reset token | None |

### 3.2 Admin Profile, Sessions & API Keys (12)

Base: `/api/profile` and `/api/auth/me`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/auth/me` | Fetch current administrator profile | Bearer |
| PATCH | `/profile` | Update profile (name, avatar, phone) | Bearer |
| POST | `/profile/change-password` | Change password (requires old password) | Bearer |
| POST | `/profile/2fa/setup` | Generate TOTP secret and QR code | Bearer |
| POST | `/profile/2fa/enable` | Confirm and enforce TOTP MFA | Bearer |
| POST | `/profile/2fa/disable` | Disable 2FA (requires password confirmation) | Bearer |
| GET | `/profile/sessions` | List active sessions/devices for current admin | Bearer |
| DELETE | `/profile/sessions/:id` | Revoke a specific session | Bearer |
| DELETE | `/profile/sessions/other` | Revoke all other sessions except current | Bearer |
| GET | `/profile/api-keys` | List service API tokens (CLI / runner nodes) | Bearer |
| POST | `/profile/api-keys` | Generate new scoped API token | Bearer |
| DELETE | `/profile/api-keys/:id` | Revoke a service API token | Bearer |

> Route order: register `DELETE /profile/sessions/other` **before** `/profile/sessions/:id`, otherwise `other` is captured as an `:id`.

### 3.3 Corporate Tenants & KYB Verifications (7)

Base: `/api/companies`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/companies` | List tenants (`page`, `limit`, `search`, `status`) | Bearer |
| GET | `/companies/:id` | Full company dossier (metadata, users, billing, tickets) | Bearer |
| POST | `/companies` | Provision a new tenant workspace | Bearer |
| PATCH | `/companies/:id` | Update metadata, seat limits, contact details | Bearer |
| PATCH | `/companies/:id/status` | Suspend / reactivate / archive tenant (audit reason required) | Bearer |
| POST | `/companies/:id/verify` | Approve or reject KYB (`approved: boolean`, `reason?: string`) | Bearer |
| POST | `/companies/:id/extend-trial` | Grant additional trial days | Bearer |

### 3.4 Subscriptions & Pricing Plans (7)

Base: `/api/subscriptions` and `/api/plans`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/subscriptions` | List tenant subscriptions with intervals and renewal dates | Bearer |
| GET | `/subscriptions/:id` | Subscription details and invoice schedule | Bearer |
| POST | `/subscriptions/:id/change-plan` | Upgrade/downgrade (`newPlanVersionId`, `billingInterval`) | Bearer |
| POST | `/subscriptions/:id/extend-trial` | Extend trial days | Bearer |
| POST | `/subscriptions/:id/cancel` | Cancel (`cancelAtPeriodEnd: boolean`, `reason: string`) | Bearer |
| GET | `/subscriptions/plans` (or `/plans`) | List public pricing tiers (Starter, Growth, Pro, Enterprise) | Bearer |
| PUT | `/subscriptions/plans/:id` | Update tier parameters, feature flags, seat prices | Bearer |

### 3.5 Payments, Transactions & Invoicing (5)

Base: `/api/payments`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/payments` | List transactions (filter by `status`, `gateway`, date) | Bearer |
| GET | `/payments/:id` | Transaction voucher and invoice receipt | Bearer |
| POST | `/payments/:id/refund` | Full or partial refund (`reason: string`, `refundAmount?: number`) | Bearer |
| GET | `/payments/export` | Download ledger (CSV / JSON) | Bearer |
| POST | `/payments/webhook/:gateway` | Public gateway webhook (bKash, SSLCOMMERZ, Stripe) | Signature |

> Register `/payments/export` **before** `/payments/:id`.

### 3.6 Support Tickets & Incident Management (6)

Base: `/api/support/tickets` (alias `/api/tickets`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/support/tickets` | List tickets (`status`, `priority`, `search`, pagination) | Bearer |
| GET | `/support/tickets/:id` | Conversation history, internal notes, attachments | Bearer |
| POST | `/support/tickets` | Open ticket on behalf of a tenant | Bearer |
| POST | `/support/tickets/:id/replies` | Post public reply to tenant | Bearer |
| POST | `/support/tickets/:id/notes` | Post private internal note (`isInternalNote: true`) | Bearer |
| PATCH | `/support/tickets/:id/status` | Update status: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` | Bearer |

### 3.7 RBAC Roles & Admin Operators (8)

Base: `/api/roles` and `/api/admin-users`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/roles` | List roles and permission matrices | Bearer |
| POST | `/roles` | Create custom administrative role | Bearer |
| PUT | `/roles/:id` | Update role permissions (16 permission flags) | Bearer |
| DELETE | `/roles/:id` | Delete role (blocks protected `SUPER_ADMIN`) | Bearer |
| GET | `/admin-users` | List platform staff operators and super admins | Bearer |
| POST | `/admin-users` | Invite operator (`name`, `email`, `role`, temporary password) | Bearer |
| PATCH | `/admin-users/:id` | Update details, assigned role, or suspended status | Bearer |
| DELETE | `/admin-users/:id` | Remove operator (**AC-02:** protects root super admin) | Bearer |

### 3.8 Platform Settings & Security Policies (6)

Base: `/api/settings` and `/api/security-settings`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/settings` | Operational settings (currency, maintenance mode, trial days) | Bearer |
| PATCH | `/settings` | Update settings and toggle maintenance mode | Bearer |
| GET | `/security-settings` | Security policies (2FA enforcement, IP whitelist, lockouts) | Bearer |
| PATCH | `/security-settings` | Update policies and IP allowlist | Bearer |
| POST | `/security/revoke-all-sessions` | Emergency invalidate all sessions platform-wide | Bearer |
| POST | `/settings/reset-defaults` | Reset settings to factory defaults | Bearer |

### 3.9 Infrastructure Telemetry, Jobs & Webhooks (9)

Base: `/api/health`, `/api/jobs`, `/api/webhooks`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/health` | Basic health probe for uptime monitors / load balancers | None |
| GET | `/health/services` | Detailed telemetry (API, Database, Redis, S3, Mailer, latency) | Bearer |
| POST | `/health/services/:id/restart` | Cycle service cache or restart worker | Bearer |
| GET | `/jobs` | List BullMQ queues (active, waiting, completed, failed counts) | Bearer |
| POST | `/jobs/:id/retry` | Re-queue a failed job | Bearer |
| POST | `/jobs/dead-letter/purge` | Purge dead-letter queue items | Bearer |
| GET | `/webhooks` | Webhook delivery logs and response codes | Bearer |
| POST | `/webhooks/test` | Dispatch mock test event to a target URL | Bearer |
| POST | `/webhooks/:id/resend` | Re-dispatch an existing webhook payload | Bearer |

### 3.10 Announcements, Coupons & Integrations (10)

Base: `/api/announcements`, `/api/promotions`, `/api/integrations`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/announcements` | List broadcast notifications across tenant dashboards | Bearer |
| POST | `/announcements` | Publish notice (target audience, severity) | Bearer |
| PATCH | `/announcements/:id/status` | Toggle visibility (active / inactive) | Bearer |
| DELETE | `/announcements/:id` | Archive / delete notice | Bearer |
| GET | `/promotions/coupons` | List coupons, usage limits, expiries | Bearer |
| POST | `/promotions/coupons` | Create coupon code | Bearer |
| DELETE | `/promotions/coupons/:id` | Permanently delete coupon | Bearer |
| GET | `/integrations` | Integration statuses (payment, storage, mailer, SMS) | Bearer |
| POST | `/integrations/:id/config` | Save and encrypt third-party credentials | Bearer |
| POST | `/integrations/:id/disconnect` | Disconnect integration provider | Bearer |

### 3.11 Immutable Audit Logging (2)

Base: `/api/audit-logs` (alias `/api/logs`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/audit-logs` | Query audit trail (`actor`, `action`, `outcome`, date) | Bearer |
| GET | `/audit-logs/export` | Export audit trail (CSV / JSON) | Bearer |

### 3.12 Dashboard KPI Metrics & Live Activity (2)

Base: `/api/dashboard`

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| GET | `/dashboard/metrics` (or `/summary`) | Aggregate KPIs (MRR, active tenants, KYC queue, open tickets) | Bearer |
| GET | `/dashboard/activity` | Live real-time system event stream | Bearer |

> Implement `/dashboard/activity` with Server-Sent Events (SSE) or WebSocket.

---

## 4. Enums

```js
export const TenantStatus = ["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"];
export const TicketStatus = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const TicketPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const BillingInterval = ["MONTHLY", "YEARLY"];
export const PaymentGateway = ["bkash", "sslcommerz", "stripe"];
export const AuditOutcome = ["SUCCESS", "FAILURE"];
```

> Exact enum values are suggestions except `TicketStatus`, which is fixed by the spec.

---

## 5. Business Rules & Security

1. **Protected SUPER_ADMIN role** — `DELETE /roles/:id` must return `403` for it.
2. **AC-02** — `DELETE /admin-users/:id` must never remove the root super admin.
3. **Status transitions** — Invalid transitions (e.g. `SUSPENDED → SUSPENDED`) return `409` with the `errors` envelope.
4. **Audit reason** — `PATCH /companies/:id/status` requires a non-empty `reason`; store it in the audit log.
5. **2FA login flow** — If 2FA is enabled, `/auth/login` returns a short-lived temp token; `/auth/verify-2fa` exchanges it for access + refresh tokens.
6. **Refresh tokens** — Store hashed, rotate on every refresh, revoke on logout.
7. **Sessions** — Each login creates a session record (device, IP, user agent, last active) so it can be listed and revoked.
8. **API keys** — Show the raw token only once at creation; store a hash and scopes.
9. **Integration credentials** — Encrypt at rest (AES-256-GCM); never return secrets in `GET /integrations`.
10. **Webhook signatures** — Verify gateway signatures on `/payments/webhook/:gateway`; make handlers idempotent.
11. **Audit log immutability** — Append-only; no update or delete endpoints and no DB-level delete permission for the app user.
12. **Rate limiting** — Strict limits on `/auth/login`, `/auth/forgot-password`, `/auth/verify-2fa`; lockout after repeated failures per security settings.
13. **IP allowlist** — When enabled in security settings, reject requests from non-listed IPs.
14. **Maintenance mode** — When enabled, tenant-facing routes return `503`; Super Admin routes keep working.
15. **Audit everything sensitive** — Log actor, action, target, outcome, IP, timestamp for all mutating admin actions.

---

## 6. Suggested Project Structure

```
backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── env.js
│   │   ├── redis.js
│   │   └── queues.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── permissions.js
│   │   ├── validate.js
│   │   ├── rateLimit.js
│   │   ├── ipAllowlist.js
│   │   ├── audit.js
│   │   └── errorHandler.js
│   ├── modules/
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── companies/
│   │   ├── subscriptions/
│   │   ├── payments/
│   │   ├── support/
│   │   ├── roles/
│   │   ├── admin-users/
│   │   ├── settings/
│   │   ├── health/
│   │   ├── jobs/
│   │   ├── webhooks/
│   │   ├── announcements/
│   │   ├── promotions/
│   │   ├── integrations/
│   │   ├── audit-logs/
│   │   └── dashboard/
│   ├── workers/
│   └── utils/
│       ├── response.js
│       ├── pagination.js
│       ├── crypto.js
│       └── tokens.js
├── .env.example
└── package.json
```

Each module contains: `*.routes.js`, `*.controller.js`, `*.service.js`, `*.validation.js`.

---

## 7. Environment Variables

```env
NODE_ENV=development
PORT=5000

DATABASE_URL=
REDIS_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
JWT_TEMP_SECRET=
ENCRYPTION_KEY=

CLIENT_URL=http://localhost:3000

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
MAIL_FROM=

S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=

BKASH_APP_KEY=
BKASH_APP_SECRET=
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASS=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 8. Frontend Contract

The frontend `apiClient` (`lib/api-client.ts`) transparently handles the standard Express/Prisma envelopes shown in section 2. Keep these consistent across all modules:

- Always return `success` (boolean).
- Lists: `data` array + `pagination` object.
- Errors: `message` string + optional `errors` object keyed by field.
- Use `401` for expired access tokens so the client can call `/auth/refresh` and retry.

---

## 9. Implementation Checklist

- [ ] Project setup (Express, Prisma, Redis, env validation)
- [ ] Response / error helpers and global error handler
- [ ] Auth module (login, register, refresh, logout, 2FA, password reset)
- [ ] RBAC middleware with 16 permission flags
- [ ] Profile, sessions, API keys
- [ ] Companies and KYB verification
- [ ] Subscriptions and plans
- [ ] Payments, refunds, gateway webhooks, export
- [ ] Support tickets
- [ ] Roles and admin users (with protected-role rules)
- [ ] Settings and security policies
- [ ] Health, BullMQ jobs, webhooks log
- [ ] Announcements, coupons, integrations
- [ ] Audit logging middleware and endpoints
- [ ] Dashboard metrics and activity stream
- [ ] Rate limiting, IP allowlist, maintenance mode
- [ ] Seed script (root super admin, default roles, plans)
- [ ] API tests and Postman/OpenAPI collection

---

## 10. Endpoint Count Summary

| # | Module | Endpoints |
|---|---|---|
| 1 | Authentication | 7 |
| 2 | Profile, Sessions, API Keys | 12 |
| 3 | Companies & KYB | 7 |
| 4 | Subscriptions & Plans | 7 |
| 5 | Payments | 5 |
| 6 | Support Tickets | 6 |
| 7 | RBAC & Admin Users | 8 |
| 8 | Settings & Security | 6 |
| 9 | Health, Jobs, Webhooks | 9 |
| 10 | Announcements, Coupons, Integrations | 10 |
| 11 | Audit Logs | 2 |
| 12 | Dashboard | 2 |
| | **Total** | **81** |