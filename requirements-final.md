# WorkSphere — Super Admin Dashboard Specification

> **Platform Operations & Workforce Intelligence System**  
> *Complete Functional Specification & Page Inventory (From Authentication to System Administration)*

---

## Document Metadata

| Field | Details |
| :--- | :--- |
| **Product** | **WorkSphere** — Employee Management & Workforce Intelligence Platform |
| **Prepared For** | **WebQ LTD.** |
| **Document Type** | Super Admin Dashboard Functional Requirements & Page Inventory |
| **Version** | **1.0** — Editable Technical Baseline |
| **Release Date** | October 2026 |
| **Technology Baseline** | Next.js (App Router) + TypeScript, Express.js API, PostgreSQL, Prisma ORM, Redis, BullMQ, Socket.IO |
| **Target Audience** | Product Owner, UI/UX Designer, Frontend Engineers, Backend Engineers, QA Engineers, DevOps |

---

## Table of Contents

1. [Document Purpose & Operational Scope](#1-document-purpose--operational-scope)
2. [Product Boundaries & Access Restrictions](#2-product-boundaries--access-restrictions)
3. [Information Architecture & Route Inventory](#3-information-architecture--route-inventory)
4. [Global Admin Layout & Navigation](#4-global-admin-layout--navigation)
   - [4.1 Persistent Header](#41-persistent-header)
   - [4.2 Sidebar Navigation Structure](#42-sidebar-navigation-structure)
5. [Authentication & Session Flow](#5-authentication--session-flow)
   - [5.1 Super Admin Sign-In](#51-super-admin-sign-in)
   - [5.2 Forgot Password Request](#52-forgot-password-request)
   - [5.3 Reset Password Execution](#53-reset-password-execution)
   - [5.4 Two-Factor Authentication (2FA)](#54-two-factor-authentication-2fa)
6. [Dashboard Overview](#6-dashboard-overview)
   - [6.1 Platform KPI Cards](#61-platform-kpi-cards)
   - [6.2 Visual Charts & Live Telemetry](#62-visual-charts--live-telemetry)
7. [Tenant Operations & Company Management](#7-tenant-operations--company-management)
   - [7.1 Companies Directory](#71-companies-directory)
   - [7.2 Company Details View](#72-company-details-view)
   - [7.3 Company Verification Queue](#73-company-verification-queue)
   - [7.4 Suspension & Reactivation Governance](#74-suspension--reactivation-governance)
8. [SaaS Revenue, Plans & Billing](#8-saas-revenue-plans--billing)
   - [8.1 Plans & Feature Entitlements](#81-plans--feature-entitlements)
   - [8.2 Tenant Subscription Records](#82-tenant-subscription-records)
   - [8.3 Payment Transactions & Reconciliation](#83-payment-transactions--reconciliation)
   - [8.4 Coupons, Promotions & Trial Policies](#84-coupons-promotions--trial-policies)
9. [Support Operations](#9-support-operations)
   - [9.1 Support Ticket Queue](#91-support-ticket-queue)
   - [9.2 Ticket Conversation & Details](#92-ticket-conversation--details)
   - [9.3 Platform Broadcast Announcements](#93-platform-broadcast-announcements)
10. [Platform Administration & Operations](#10-platform-administration--operations)
    - [10.1 Platform Admin Users](#101-platform-admin-users)
    - [10.2 Roles & Granular Permissions (RBAC)](#102-roles--granular-permissions-rbac)
    - [10.3 Immutable Audit Logs](#103-immutable-audit-logs)
    - [10.4 System Health & Infrastructure Telemetry](#104-system-health--infrastructure-telemetry)
    - [10.5 Background Jobs & Outbound Webhooks](#105-background-jobs--outbound-webhooks)
11. [Platform Configuration & Integrations](#11-platform-configuration--integrations)
    - [11.1 Global Platform Settings](#111-global-platform-settings)
    - [11.2 Third-Party Integrations](#112-third-party-integrations)
    - [11.3 Security Policies](#113-security-policies)
12. [Account & Self-Service Management](#12-account--self-service-management)
    - [12.1 Personal Profile](#121-personal-profile)
    - [12.2 Active Sessions & Security Revocation](#122-active-sessions--security-revocation)
13. [Shared UI, Forms & UX States](#13-shared-ui-forms--ux-states)
14. [Role-Based Access Control (RBAC) Matrix](#14-role-based-access-control-rbac-matrix)
15. [Core Business Workflows](#15-core-business-workflows)
    - [15.1 Super Admin Login Flow](#151-super-admin-login-flow)
    - [15.2 Company Suspension Flow](#152-company-suspension-flow)
    - [15.3 Subscription Plan Change Flow](#153-subscription-plan-change-flow)
    - [15.4 Payment Refund Flow](#154-payment-refund-flow)
16. [REST API Route Inventory](#16-rest-api-route-inventory)
17. [Database Entities & Data Schema](#17-database-entities--data-schema)
18. [Security & Privacy Standards](#18-security--privacy-standards)
19. [Non-Functional Requirements (NFRs)](#19-non-functional-requirements-nfrs)
20. [Formal Acceptance Criteria](#20-formal-acceptance-criteria)
21. [Development Priority Roadmap](#21-development-priority-roadmap)
22. [Developer Handoff Guidelines](#22-developer-handoff-guidelines)
23. [Appendix A: Navigation Tree](#appendix-a-navigation-tree)

---

## 1. Document Purpose & Operational Scope

This document specifies the page-by-page functional and technical requirements for the **WorkSphere Super Admin Dashboard**, covering user flows from initial sign-in to platform operations. It details:
- Page purposes, accessible UI controls, data tables, and interactive action sets.
- Granular permission scopes, operational safeguards, and state representations (loading, empty, error, access-denied).
- Integration boundaries between the Next.js frontend and the external Express.js backend.

This document serves as the implementation baseline for WorkSphere SRS v1.0 (Super Admin Scope). Review and alignment with the WebQ LTD. Product Owner is required before finalizing production deployments and contracts.

---

## 2. Product Boundaries & Access Restrictions

> [!IMPORTANT]
> The Super Admin is a **SaaS platform operator** managing the WorkSphere ecosystem. A Super Admin account is **not** a tenant Company Owner account.

1. **Default Privilege Boundary**: Super Admin default privileges are restricted to platform-level metadata, billing administration, customer support routing, plan/pricing tiers, and audited administrative tasks.
2. **Tenant Privacy Protection**: Super Admins **never** receive unrestricted access to employee activity screenshots, biometric recordings, payroll figures, or confidential internal messages.
3. **Emergency Support Access**: Viewing private tenant data is permitted only via purpose-bounded, time-limited, separately authorized support workflows with mandatory reason logging and immutable audit trails.
4. **Enforcement Principle**: Permissions must **never** be enforced solely by client-side UI hiding. Backend server-side authorization checks are mandatory on every request.
5. **Data Fidelity**: When backend API telemetry is unavailable, charts and KPI widgets must display distinct empty, offline, or loading states. Synthetic mock data must never masquerade as verified production metrics.

---

## 3. Information Architecture & Route Inventory

All Super Admin routes use the prefix: `/super-admin`.

| Stage | Route | Route Purpose | Access Level |
| :---: | :--- | :--- | :--- |
| **01** | `/super-admin/login` | Platform Super Admin secure sign-in portal | Public (Rate-limited) |
| **02** | `/super-admin/forgot-password` | Request password reset token via work email | Public (Rate-limited) |
| **03** | `/super-admin/reset-password` | Password update using secure one-time token | Token-gated |
| **04** | `/super-admin/verify-2fa` | Second-factor authenticator challenge | Session-gated |
| **05** | `/super-admin/dashboard` | Platform-wide operational overview & metrics | Privileged Admin |
| **06** | `/super-admin/companies` | Tenant directory, status controls & inspection | Privileged Admin |
| **07** | `/super-admin/companies/[id]` | Tenant deep-dive: usage, billing, audit history | Privileged Admin |
| **08** | `/super-admin/company-verifications` | Pending tenant compliance & KYC/KYB reviews | Compliance Admin |
| **09** | `/super-admin/subscriptions` | Active tenant subscription records & lifecycles | Billing Admin |
| **10** | `/super-admin/plans` | Pricing tiers, quotas, and feature flags | Billing Admin |
| **11** | `/super-admin/payments` | Gateway transactions, invoice receipts & refunds | Billing Admin |
| **12** | `/super-admin/promotions` | Discount coupons and trial extension management | Billing Admin |
| **13** | `/super-admin/tickets` | Multi-tenant customer support ticket desk | Support Staff |
| **14** | `/super-admin/announcements` | Broadcast system notices to all or select tenants | Platform Admin |
| **15** | `/super-admin/admin-users` | Platform operator account provisioning | Root Admin |
| **16** | `/super-admin/roles` | RBAC role definitions and permission matrices | Root Admin |
| **17** | `/super-admin/audit-logs` | Searchable append-only administrator audit trail | Auditor / Root |
| **18** | `/super-admin/system-health` | Real-time infrastructure latency and uptime | DevOps / Admin |
| **19** | `/super-admin/jobs-webhooks` | Background queue monitoring and webhook retries | DevOps / Admin |
| **20** | `/super-admin/settings` | Platform branding, localization, and defaults | Platform Admin |
| **21** | `/super-admin/integrations` | Third-party API credentials and connection tests | Root Admin |
| **22** | `/super-admin/security` | Global password policies, 2FA rules & IP ranges | Security Admin |
| **23** | `/super-admin/profile` | Operator personal profile and preferences | Authenticated Admin |
| **24** | `/super-admin/profile/security` | Operator credential updates and active sessions | Authenticated Admin |

---

## 4. Global Admin Layout & Navigation

### 4.1 Persistent Header

The persistent top header is rendered on all authenticated pages (`min-h-[56px]` on mobile, `64px` on desktop) and contains:
1. **Brand & Environment Identity**: WorkSphere logo, environment indicator pill (`Production` vs `Staging`, provided by system configuration), and "Super Admin" label.
2. **Authorized Global Search**: Fast lookup palette restricted to safe platform metadata:
   - Company name or tenant slug.
   - Subscription ID or payment reference.
   - Support ticket ID.
   *(Tenant-private employee data is never indexed in global platform search).*
3. **Notification Bell**: Displays unread administrative alert count with a popover drawer for system events.
4. **Theme Switcher**: Instant toggle between Dark Mode and Light Mode.
5. **Profile Menu**: Direct navigation to:
   - *General Profile* (`/super-admin/profile`)
   - *Password & 2FA Protection* (`/super-admin/profile?tab=security`)
   - *Active Concurrent Sessions* (`/super-admin/profile?tab=sessions`)
   - *Sign Out* (terminates token, revokes session, redirects to sign-in).

### 4.2 Sidebar Navigation Structure

The sidebar provides structured grouping with visual active indicators, count badges, and mobile drawer support:

| Navigation Group | Menu Item | Target Route | Page Scope & Responsibilities |
| :--- | :--- | :--- | :--- |
| **Overview** | Dashboard | `/super-admin/dashboard` | Platform KPIs, velocity trends, alerts, recent activity feed |
| **Tenant Operations** | Companies | `/super-admin/companies` | Corporate tenant table, search, filters, lifecycle actions |
| **Tenant Operations** | Verification Queue | `/super-admin/company-verifications` | Pending KYB/KYC verification review and document approval |
| **Tenant Operations** | Company Details | `/super-admin/companies/[id]` | Tenant deep-dive (opened via row selection) |
| **SaaS Revenue** | Subscriptions | `/super-admin/subscriptions` | Tenant subscription lifecycles, renewal dates, cancel/extend |
| **SaaS Revenue** | Plans & Features | `/super-admin/plans` | Pricing plans, quota limits, screenshot retention, feature flags |
| **SaaS Revenue** | Payments | `/super-admin/payments` | Gateway transactions, transaction IDs, receipts, refunds |
| **SaaS Revenue** | Coupons & Trials | `/super-admin/promotions` | Discount coupon codes and trial extension policies |
| **Support** | Support Tickets | `/super-admin/tickets` | Ticket inbox, staff assignment, customer replies, internal notes |
| **Support** | Announcements | `/super-admin/announcements` | Broadcast system notices to all or selected tenant tiers |
| **Platform Operations** | Platform Users | `/super-admin/admin-users` | Operator accounts, staff invitations, account status toggles |
| **Platform Operations** | Roles & Permissions | `/super-admin/roles` | RBAC permission matrix and custom operator roles |
| **Platform Operations** | Audit Logs | `/super-admin/audit-logs` | Append-only system audit log with JSON/CSV export |
| **Platform Operations** | System Health | `/super-admin/system-health` | Live service latency, uptime SLA, database/redis status |
| **Platform Operations** | Jobs & Webhooks | `/super-admin/jobs-webhooks` | BullMQ worker queues, failed job retry, webhook event logs |
| **Configuration** | Platform Settings | `/super-admin/settings` | Platform branding, maintenance mode, currency, defaults |
| **Configuration** | Integrations | `/super-admin/integrations` | Payment gateways, S3 storage, SMTP mailer, masked secrets |
| **Configuration** | Security Settings | `/super-admin/security` | Mandatory 2FA policies, lockout limits, IP allowlists |
| **Account** | My Profile | `/super-admin/profile` | Operator personal profile details and preferences |
| **Account** | Security & Sessions | `/super-admin/profile/security` | Password management, active session list and revocation |

---

## 5. Authentication & Session Flow

### 5.1 Super Admin Sign-In
- **Route**: `/super-admin/login`
- **Access Rule**: Public self-registration is strictly prohibited. Super Admin accounts are provisioned via approved internal workflows only.
- **Form Controls**: Normalized Email address, Password (with toggleable visibility), Remember Me checkbox (if permitted by policy), "Sign In" primary action button.
- **Security Protections**:
  - Client-side and server-side input normalization.
  - Generic authentication errors (*"Invalid credentials"*) to prevent user enumeration.
  - Server-side brute-force rate limiting and lockout.
  - Session credential rotation upon successful sign-in.
  - Audit logging of all authentication events (success, failure, IP, user-agent).
- **Interactive States**: Idle, submitting (disabled button with spinner), invalid credentials, account locked/disabled, MFA required, network error.

### 5.2 Forgot Password Request
- **Route**: `/super-admin/forgot-password`
- **Form Controls**: Work email input, "Send Reset Link" action.
- **Security Rule**: Always display a generic confirmation message (*"If an account matches that email, a password reset link has been dispatched."*) to prevent account enumeration.
- **Token Properties**: Cryptographically secure, single-use, hashed at rest, with a short expiration window (15–30 minutes).

### 5.3 Reset Password Execution
- **Route**: `/super-admin/reset-password?token=...`
- **Form Controls**: New Password, Confirm Password, password policy checklist (minimum length, special characters, uppercase).
- **Post-Reset Behavior**: Invalidate all existing privileged sessions across all devices; require immediate fresh login with the new password.

### 5.4 Two-Factor Authentication (2FA)
- **Route**: `/super-admin/verify-2fa`
- **Methods**: Time-based One-Time Password (TOTP) compliant with standard authenticator applications (Google Authenticator, Authy, 1Password) and single-use emergency backup recovery codes.
- **Form Controls**: 6-digit auto-advancing verification code boxes, paste support, submit button, backup code fallback link.
- **Security Rule**: Strict attempt limits (max 3–5 failed attempts) before temporary challenge lockout. Privileged access is granted only after verification.

---

## 6. Dashboard Overview

- **Route**: `/super-admin/dashboard`

### 6.1 Platform KPI Cards

| KPI Metric Card | Target Calculation & Behavior | Click Navigation Target |
| :--- | :--- | :--- |
| **Total Companies** | Total non-deleted corporate tenant records across all tiers | `/super-admin/companies` |
| **Active Companies** | Count of companies currently in `ACTIVE` status | `/super-admin/companies?status=ACTIVE` |
| **Pending Verification** | Tenants awaiting KYB/KYC identity review | `/super-admin/company-verifications` |
| **Suspended Companies** | Organizations under administrative suspension | `/super-admin/companies?status=SUSPENDED` |
| **Total Employees** | Total active employee profiles managed across all tenants | `/super-admin/companies` |
| **Active Subscriptions** | Subscriptions currently active within their paid billing window | `/super-admin/subscriptions` |
| **Monthly Recurring Revenue (MRR)** | Normalized recurring monthly revenue in platform base currency | `/super-admin/payments` |
| **Payments This Month** | Successfully captured payments within current calendar month | `/super-admin/payments` |
| **Open Support Tickets** | Customer tickets in `OPEN`, `ASSIGNED`, or `IN_PROGRESS` status | `/super-admin/tickets` |
| **Platform Availability** | Telemetry-verified uptime percentage over rolling 30-day window | `/super-admin/system-health` |

### 6.2 Visual Charts & Live Telemetry
1. **Monthly Company Registrations**: Interactive bar/area chart with daily, weekly, and monthly interval toggles.
2. **Subscription Distribution**: Plan breakdown (Starter vs Pro vs Enterprise) and lifecycle status pie chart.
3. **Revenue Velocity Trends**: Area chart showing gross collections, processed refunds, and net revenue.
4. **Platform Usage & Activity**: Active companies, check-ins, and API request volume.
5. **Recent Administrative Activity**: Live feed of tenant registrations, plan upgrades, payment events, and security actions.
6. **Action Required Panel**: Highlights pending verifications, past-due subscriptions, failed webhook dispatches, and overdue tickets.

---

## 7. Tenant Operations & Company Management

### 7.1 Companies Directory
- **Route**: `/super-admin/companies`
- **Table Columns**: Company Name, Slug / Workspace URL, Owner Name & Email, Creation Date, Employee Count / Quota Usage, Active Plan, Verification Status, Account Status, Last Active Timestamp, Actions Menu.
- **Filters**: Status (`ALL`, `ACTIVE`, `PENDING`, `SUSPENDED`, `ARCHIVED`), Verification State, Subscription Tier, Date Range.
- **Search**: Case-insensitive search matching company name, workspace slug, or owner email.
- **Row Actions**: View Profile Details, Edit Platform Metadata, Change Subscription Plan, Suspend Tenant, Reactivate Tenant.

### 7.2 Company Details View
- **Route**: `/super-admin/companies/[id]`
- **Tabbed Structure**:
  - **Overview**: Legal name, slug, logo, registration number, primary contacts, creation timestamp, current status.
  - **Subscription & Usage**: Active tier, renewal date, employee seat usage vs plan limit, storage consumption, feature entitlements.
  - **Billing History**: Tabular view of past transactions, invoices, receipts, and refund metadata.
  - **Support History**: Tickets filed by this organization, assigned agents, and resolution times.
  - **Platform Activity**: Company-scoped audit events and administrative actions.
  - **Administrative Actions**: Manual status changes, plan overrides, and account verification.

### 7.3 Company Verification Queue
- **Route**: `/super-admin/company-verifications`
- **Queue Content**: Unverified companies, submitted business documentation (trade license, certificate of incorporation), submission timestamp, assigned reviewer.
- **Review Actions**:
  - `Approve Verification`: Sets tenant to verified status; logs audit record.
  - `Reject Submission`: Requires mandatory rejection reason; sends notice to tenant owner.
  - `Request Information`: Opens dialog to request clarifying documents.
- **Privacy Standard**: Uploaded corporate documents must be served via time-limited, signed URLs only accessible to authorized reviewers.

### 7.4 Suspension & Reactivation Governance
- **Mandatory Suspension Requirements**:
  1. Operator must specify a documented business reason (non-payment, Terms of Service violation, legal compliance).
  2. Display an impact preview before confirmation (blocking employee check-ins, disabling company admin access).
  3. Confirmation checkbox stating tenant data will be safely preserved and **not** deleted.
- **Reactivation Requirements**:
  1. Validates outstanding billing or compliance blocks are resolved.
  2. Restores access according to current subscription entitlement.
  3. Writes an immutable audit entry recording actor, reason, and timestamp.

---

## 8. SaaS Revenue, Plans & Billing

### 8.1 Plans & Feature Entitlements
- **Route**: `/super-admin/plans`
- **Plan Fields**: Plan Name, Monthly Price, Annual Price, Currency, Max Employee Seats, Max Projects, Storage Quota, Monitoring Features, Screenshot Retention Duration, Export Privileges, API Access, Mobile/Desktop Access Flags, Support SLA Level, Active/Inactive status.
- **Governance**: Editing an active plan cannot alter past billing invoices. Subscriptions snapshot plan terms at creation or renewal.

### 8.2 Tenant Subscription Records
- **Route**: `/super-admin/subscriptions`
- **Table Columns**: Tenant Company, Current Plan, Billing Interval (`MONTHLY` / `ANNUAL`), Lifecycle Status (`TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`, `EXPIRED`), Start Date, Period End / Next Renewal Date, Trial Expiry, Last Payment Status, Actions.
- **Lifecycle Actions**: Change Plan, Extend Trial Period, Cancel at Period End, Resume Subscription.

### 8.3 Payment Transactions & Reconciliation
- **Route**: `/super-admin/payments`
- **Table Columns**: Payment Reference ID, Company Name, Payment Gateway (`SSLCOMMERZ`, `BKASH`, `STRIPE`, `NAGAD`), Transaction Amount, Currency, Gateway Status (`COMPLETED`, `PENDING`, `FAILED`, `REFUNDED`), Timestamp, Invoice Link, Actions.
- **Refund Policy & Flow**:
  - Requires elevated `platform.billing.refund` permission.
  - Step-up re-authentication required for refunds exceeding threshold.
  - Operator must provide a mandatory refund reason.
  - Backend communicates with payment gateway using an idempotency key to prevent duplicate charges or double refunds.

### 8.4 Coupons, Promotions & Trial Policies
- **Route**: `/super-admin/promotions`
- **Coupon Fields**: Promo Code, Description, Discount Type (`PERCENTAGE` vs `FIXED_AMOUNT`), Discount Value, Currency, Max Total Redemptions, Current Used Count, Applicable Plans, Validity Start Date, Expiration Date, Active Status.
- **Trial Management**: Administrative utility to grant approved trial extensions with explicit day counts.

---

## 9. Support Operations

### 9.1 Support Ticket Queue
- **Route**: `/super-admin/tickets`
- **Table Columns**: Ticket ID, Company Name, Subject, Category, Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), Status (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `WAITING_FOR_USER`, `RESOLVED`, `CLOSED`), Assigned Agent, Creation Date, Last Updated, SLA Breached Indicator.
- **Filters**: Status, Priority, Category, Assigned Operator, Tenant Company, SLA status.

### 9.2 Ticket Conversation & Details
- **Detail Drawer / Page**:
  - Company summary panel showing plan tier, owner contact, and support SLA.
  - Chronological conversation thread.
  - Visual separation between **Customer-Visible Replies** and **Internal Private Staff Notes** (yellow/tinted styling with lock icon).
  - Outbound response editor with file attachment support.
  - Status transition controls and assignee reassignment.

### 9.3 Platform Broadcast Announcements
- **Route**: `/super-admin/announcements`
- **Announcement Fields**: Title, Message Body (rich text), Severity (`INFO`, `WARNING`, `CRITICAL`), Target Audience (`ALL_COMPANIES`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`), Start Date/Time, Expiration Date/Time, Active Banner Toggle.
- **Audit Requirement**: Creation and publication of platform-wide broadcast announcements require privileged permissions and are logged in the audit trail.

---

## 10. Platform Administration & Operations

### 10.1 Platform Admin Users
- **Route**: `/super-admin/admin-users`
- **Operator Table**: Name, Email, Assigned Platform Role, Account Status (`ACTIVE`, `INACTIVE`, `SUSPENDED`), Two-Factor Authentication Status (Enforced / Enabled), Last Sign-In Timestamp, Last Login IP, Created Date, Actions Menu.
- **Operator Provisioning**: Controlled invitation flow requiring administrator work email and role assignment. No self-registration.
- **Safeguard**: System must prevent the deactivation or deletion of the last remaining Root Super Admin account.

### 10.2 Roles & Granular Permissions (RBAC)
- **Route**: `/super-admin/roles`
- **Permission Key Standard**: All permissions must follow the `platform.<resource>.<action>` namespace pattern:
  ```
  platform.companies.read
  platform.companies.verify
  platform.companies.suspend
  platform.billing.read
  platform.billing.refund
  platform.plans.manage
  platform.promotions.manage
  platform.support.read
  platform.support.respond
  platform.support.internal_notes
  platform.admins.manage
  platform.roles.manage
  platform.audit_logs.read
  platform.system.health
  platform.settings.update
  platform.integrations.manage
  platform.monitoring.support_access
  ```
- **System Roles**: Default roles (`Super Administrator`, `Support Specialist`, `Finance & Billing Manager`, `Compliance Auditor`) are system-locked. Custom roles can be created with granular permission selections.

### 10.3 Immutable Audit Logs
- **Route**: `/super-admin/audit-logs`
- **Table Columns**: Timestamp (UTC + Local), Actor Name & Email, Actor Role, Action Taken, Target Resource Type, Resource ID, Outcome (`SUCCESS`, `FAILURE`, `DENIED`), IP Address, User Agent, Details / Reason, Inspect Button.
- **Audit Detail Modal**: Shows before/after change JSON snapshots with sensitive values (passwords, tokens, secret keys) redacted.
- **Data Export**: Export to JSON and CSV format with rate limits; export actions themselves trigger an audit log entry.
- **Storage Standard**: Append-only storage. Super Admins cannot delete, modify, or truncate audit log records.

### 10.4 System Health & Infrastructure Telemetry
- **Route**: `/super-admin/system-health`
- **Monitored Nodes**: PostgreSQL Primary Node, Redis In-Memory Cluster, BullMQ Asynchronous Workers, Socket.IO Realtime Server, Encrypted Object Storage (S3), Payment Gateways (SSLCommerz, bKash, Stripe), SMTP Gateway.
- **Telemetry Indicators**: Real-time status badge (`OPERATIONAL`, `DEGRADED`, `OUTAGE`), response latency (ms), rolling uptime SLA percentage, last health check timestamp, incident summary.
- **Rule**: Metrics must be retrieved from live health endpoints, not hardcoded dummy text.

### 10.5 Background Jobs & Outbound Webhooks
- **Route**: `/super-admin/jobs-webhooks`
- **Job Queues (BullMQ)**: Queue Name, Job Name, Job ID, Status (`WAITING`, `ACTIVE`, `COMPLETED`, `FAILED`), Attempt Count, Max Attempts, Created Timestamp, Execution Time, Error Stack Trace.
  - Action: Manual retry trigger for failed idempotent jobs.
- **Webhook Dispatch Log**: Provider / Target URL, Event Type, Received / Sent Timestamp, HTTP Response Status Code, Duration (ms), Delivery Outcome, Retry Count.
  - Action: Safe manual re-delivery trigger with idempotency protections.

---

## 11. Platform Configuration & Integrations

### 11.1 Global Platform Settings
- **Route**: `/super-admin/settings`
- **Configuration Sections**:
  - **Platform Branding**: Platform Name, Primary Support Email, Platform Logo & Favicon.
  - **Localization & Currency**: Default Platform Language (English / Bangla), Default Base Currency (`BDT ৳`, `USD $`), Date/Time formatting.
  - **Tenant Onboarding Defaults**: Self-service registration flag, mandatory KYC/KYB approval requirement, default trial duration (days).
  - **System Maintenance Mode**: Global maintenance toggle, custom maintenance notice message, admin bypass allowlist.

### 11.2 Third-Party Integrations
- **Route**: `/super-admin/integrations`
- **Managed Providers**:
  - **Payment Gateways**: SSLCommerz, bKash Merchant, Stripe Billing.
  - **Object Storage**: AWS S3 / Cloudinary (bucket, region, access credentials).
  - **Email Service**: SendGrid / Custom SMTP (host, port, credentials, sender address).
  - **SMS Gateways**: Twilio / Local Bangladeshi SMS provider.
  - **Realtime / Meetings**: Agora, Google Calendar / Meet integration.
- **Security Rule**: API keys and secrets must remain masked (`••••••••`) in the UI. Secrets are persisted server-side in secure secret stores; plain secrets are never returned in client API responses.
- **Connection Diagnostics**: "Test Connection" button on each provider to verify credentials with live ping and audit logging.

### 11.3 Security Policies
- **Route**: `/super-admin/security`
- **Configurable Policies**:
  - Mandatory 2FA enforcement for all platform operators.
  - Session timeout duration (minutes of inactivity).
  - Single active session enforcement per operator account.
  - Brute-force account lockout threshold (maximum consecutive failed attempts).
  - Lockout cooldown duration (minutes).
  - IP Address allowlist / CIDR blocks for administrative access.
  - Password complexity standards (minimum length, character classes, expiration window in days).

---

## 12. Account & Self-Service Management

### 12.1 Personal Profile
- **Route**: `/super-admin/profile`
- **Self-Service Controls**: Operator display name, profile avatar photo upload, verified email address, preferred timezone, interface display language.
- **Rule**: Updating an administrator email address requires email verification on both old and new addresses.

### 12.2 Active Sessions & Security Revocation
- **Route**: `/super-admin/profile?tab=sessions` or `/super-admin/profile/security`
- **Session List**: Active device name, browser, operating system, IP address, approximate geographical location, last active timestamp, "Current Device" indicator badge.
- **Revocation Actions**: Individual "Revoke Session" button per active device, and "Terminate All Other Sessions" emergency action.
- **Password Management**: Current password verification, new password submission with confirmation.

---

## 13. Shared UI, Forms & UX States

1. **Design System Baseline**:
   - Primary: Deep Navy (`#0F2747`, `#070C18`), Blue (`#2563EB`).
   - Accents: Sky Blue (`#38BDF8`), Slate Borders (`border-slate-200`, `dark:border-slate-800`).
   - Status Palette: Green (`Emerald`) for Active/Success, Amber for Pending/Warning, Red (`Rose`) for Suspended/Failed.
   - Text Pairing: Every status pill must feature both an iconic glyph and a text label for accessibility.
2. **Standard State Handling**: Every data-driven screen must provide:
   - **Loading Skeleton**: Shimmering placeholders matching table row / card dimensions.
   - **Empty State**: Friendly illustration/icon, clear explanation, and primary call-to-action button.
   - **Error State**: Actionable error diagnosis with a "Retry" button.
   - **Access Denied**: Clear 403 message with back-navigation.
3. **Table Standards**:
   - Server-side pagination, sorting, and debounced search filters for large datasets.
   - Responsive card layout transformation on mobile viewports (< 768px).
4. **Form Standards**:
   - Inline real-time field validation with accessible error labels.
   - Submit buttons disabled with loading spinners during asynchronous operations.
   - Confirmative warning dialogs for all destructive operations (suspensions, refunds, role edits).
5. **Accessibility**:
   - WCAG 2.2 AA compliant contrast ratios.
   - Keyboard navigation support with visible focus rings.
   - Semantic HTML elements (`<main>`, `<header>`, `<aside>`, `<nav>`, `<table>`).

---

## 14. Role-Based Access Control (RBAC) Matrix

| Platform Action | Super Admin (Root) | Support Specialist | Billing Manager | Compliance Auditor |
| :--- | :---: | :---: | :---: | :---: |
| **View Dashboard KPIs** | Full | Scoped | Scoped | Read-only |
| **View Tenant Companies** | Full | Read-only | Read-only | Read-only |
| **Suspend / Reactivate Tenant** | Allowed (Reason Req.) | Denied | Denied | Denied |
| **Approve Tenant Verification** | Allowed | Allowed | Denied | Denied |
| **Edit Pricing Plans & Tiers** | Allowed | Denied | Allowed | Denied |
| **View Transaction Records** | Full | Scoped | Full | Read-only |
| **Issue Payment Refund** | Allowed (Re-auth) | Denied | Allowed (Re-auth) | Denied |
| **Reply to Support Tickets** | Allowed | Full | Denied | Denied |
| **Author Internal Staff Notes** | Allowed | Full | Allowed | Denied |
| **View Immutable Audit Logs** | Full | Denied | Denied | Full (Read-only) |
| **Export Audit Logs (CSV/JSON)** | Allowed | Denied | Denied | Allowed |
| **Manage Admin Accounts** | Full | Denied | Denied | Denied |
| **Edit RBAC Role Matrix** | Full | Denied | Denied | Denied |
| **Modify Security / 2FA Policy** | Allowed (Re-auth) | Denied | Denied | Denied |
| **Update Integration Secrets** | Allowed (Re-auth) | Denied | Denied | Denied |
| **View Employee Private Data** | Emergency Workflow Only | Denied | Denied | Denied |

---

## 15. Core Business Workflows

### 15.1 Super Admin Login Flow
```mermaid
sequenceDiagram
    autonumber
    actor Admin as Platform Admin
    participant UI as Next.js Frontend
    participant API as External Backend
    participant DB as PostgreSQL / Redis

    Admin->>UI: Enter Email & Password
    UI->>API: POST /api/v1/super-admin/auth/login
    API->>DB: Check rate-limits, verify hash & status
    alt Credentials Invalid
        API-->>UI: 401 Unauthorized (Generic error)
        UI-->>Admin: Show generic error message
    else 2FA Required
        API-->>UI: 200 OK (Temp session + 2FA Challenge token)
        UI->>Admin: Redirect to /super-admin/verify-2fa
        Admin->>UI: Submit 6-digit TOTP code
        UI->>API: POST /api/v1/super-admin/auth/verify-2fa
        API->>DB: Validate TOTP token
    end
    API->>DB: Issue rotated JWT access & refresh tokens; record login audit event
    API-->>UI: 200 OK (Tokens + Admin Profile + Permissions)
    UI->>Admin: Redirect to /super-admin/dashboard
```

### 15.2 Company Suspension Flow
1. **Initiation**: Authorized operator opens `/super-admin/companies/[id]` and selects **Suspend Company**.
2. **Impact Assessment**: UI displays a modal warning of the operational impact (blocking employee check-ins and tenant portal access while preserving all historical data).
3. **Mandatory Inputs**: Operator enters a documented business reason and checks the data preservation confirmation box.
4. **Backend Validation**: Server verifies the operator's `platform.companies.suspend` permission and active status.
5. **Execution**: Database transaction sets company status to `SUSPENDED`, revokes active tenant sessions, writes an immutable audit record, and dispatches a notification email to the tenant owner.

### 15.3 Subscription Plan Change Flow
1. Operator selects a target tenant subscription and clicks **Change Plan**.
2. Modal displays comparison of employee seat quotas, storage limits, pricing differences, and billing interval adjustments.
3. Operator confirms effective date (Immediate vs Next Renewal Period).
4. Backend updates subscription record, snapshots the new plan configuration, generates an audit trail event, and recalculates recurring billing metadata.

### 15.4 Payment Refund Flow
1. Billing operator opens settled transaction at `/super-admin/payments`.
2. Operator clicks **Issue Refund** and inputs refund amount (full or partial) and mandatory reason.
3. If the amount exceeds the security threshold, the operator completes step-up re-authentication.
4. Backend verifies remaining refundable balance, generates an idempotency key, and submits the refund request to the external payment gateway (SSLCommerz, bKash, Stripe).
5. Gateway response updates transaction state to `REFUNDED` and logs an immutable audit event.

---

## 16. REST API Route Inventory

All endpoints require HTTPS, Bearer JWT authentication (unless marked Public), and server-side RBAC validation:

```
Authentication & Account
POST   /api/v1/super-admin/auth/login            (Public rate-limited)
POST   /api/v1/super-admin/auth/logout           (Authenticated)
POST   /api/v1/super-admin/auth/refresh          (Token rotation)
POST   /api/v1/super-admin/auth/forgot-password  (Public rate-limited)
POST   /api/v1/super-admin/auth/reset-password   (Token-gated)
POST   /api/v1/super-admin/auth/verify-2fa       (Challenge-gated)
GET    /api/v1/super-admin/auth/me               (Current session profile)

Dashboard & Analytics
GET    /api/v1/super-admin/dashboard/summary     (Platform KPI summary counts)
GET    /api/v1/super-admin/dashboard/charts      (Time-series registration/revenue)
GET    /api/v1/super-admin/dashboard/activity    (Live platform activity feed)

Tenant Companies
GET    /api/v1/super-admin/companies             (Paginated directory with filters)
POST   /api/v1/super-admin/companies             (Provision corporate tenant)
GET    /api/v1/super-admin/companies/:id         (Company profile & deep metadata)
PATCH  /api/v1/super-admin/companies/:id         (Update platform metadata)
POST   /api/v1/super-admin/companies/:id/verify  (Approve KYC/KYB verification)
POST   /api/v1/super-admin/companies/:id/reject  (Reject verification with reason)
POST   /api/v1/super-admin/companies/:id/suspend (Suspend tenant with audit reason)
POST   /api/v1/super-admin/companies/:id/reactivate (Restore eligible access)

Plans & Subscriptions
GET    /api/v1/super-admin/plans                 (List subscription tiers)
POST   /api/v1/super-admin/plans                 (Create pricing plan)
PATCH  /api/v1/super-admin/plans/:id             (Update plan parameters)
GET    /api/v1/super-admin/subscriptions         (Tenant subscription records)
POST   /api/v1/super-admin/subscriptions/:id/change-plan (Modify tenant tier)
POST   /api/v1/super-admin/subscriptions/:id/extend-trial (Grant trial extension)
POST   /api/v1/super-admin/subscriptions/:id/cancel      (Cancel subscription)

Payments & Finance
GET    /api/v1/super-admin/payments              (Transaction history with filters)
GET    /api/v1/super-admin/payments/:id          (Payment detail & gateway trail)
POST   /api/v1/super-admin/payments/:id/refund   (Process gateway refund)
POST   /api/v1/super-admin/payments/:id/reconcile (Reconcile pending gateway state)
GET    /api/v1/super-admin/promotions            (Coupons and promotion codes)
POST   /api/v1/super-admin/promotions            (Create promotion coupon)

Support & Announcements
GET    /api/v1/super-admin/tickets               (Paginated ticket desk queue)
GET    /api/v1/super-admin/tickets/:id           (Conversation history & timeline)
POST   /api/v1/super-admin/tickets/:id/replies   (Send customer response)
POST   /api/v1/super-admin/tickets/:id/notes     (Add internal staff note)
PATCH  /api/v1/super-admin/tickets/:id           (Update status or priority)
POST   /api/v1/super-admin/tickets/:id/assign    (Reassign ticket operator)
GET    /api/v1/super-admin/announcements         (List platform announcements)
POST   /api/v1/super-admin/announcements         (Broadcast system announcement)

Administration & Governance
GET    /api/v1/super-admin/admin-users           (List platform operators)
POST   /api/v1/super-admin/admin-users           (Invite operator)
PATCH  /api/v1/super-admin/admin-users/:id       (Update operator status or role)
GET    /api/v1/super-admin/roles                 (List RBAC roles & permissions)
POST   /api/v1/super-admin/roles                 (Create custom role)
PATCH  /api/v1/super-admin/roles/:id             (Update role permissions)
GET    /api/v1/super-admin/audit-logs            (Query immutable audit records)
GET    /api/v1/super-admin/system-health         (Infrastructure node metrics)
GET    /api/v1/super-admin/jobs                  (BullMQ worker queue status)
POST   /api/v1/super-admin/jobs/:id/retry        (Retry failed background job)
GET    /api/v1/super-admin/webhooks              (Outbound webhook logs)

Configuration & Security
GET    /api/v1/super-admin/settings              (Platform global configuration)
PATCH  /api/v1/super-admin/settings              (Update platform configuration)
GET    /api/v1/super-admin/integrations          (List configured integrations)
POST   /api/v1/super-admin/integrations/:id/test (Run connection diagnostic)
PATCH  /api/v1/super-admin/security-policy       (Update platform security policies)
```

---

## 17. Database Entities & Data Schema

The Super Admin domain uses the following core entities within PostgreSQL:

| Entity Name | Primary Key | Key Attributes & Foreign Relationships |
| :--- | :--- | :--- |
| `platform_admins` | `id: BigInt` | `email` (unique), `password_hash`, `name`, `role_id` (FK), `status` (`ACTIVE`/`SUSPENDED`), `mfa_secret` (encrypted), `mfa_enabled`, `last_login_at`, `last_login_ip` |
| `platform_roles` | `id: String` | `name`, `slug` (unique), `description`, `is_system` (boolean), timestamps |
| `platform_permissions` | `key: String` | `description`, `category` |
| `platform_role_permissions` | Composite | `role_id` (FK), `permission_key` (FK) |
| `platform_admin_sessions` | `id: UUID` | `admin_id` (FK), `refresh_token_hash`, `user_agent`, `ip_address`, `expires_at`, `revoked_at` |
| `companies` | `id: BigInt` | `name`, `slug` (unique), `owner_email`, `status` (`ACTIVE`/`PENDING`/`SUSPENDED`/`ARCHIVED`), `verification_status`, `created_at` |
| `plans` / `plan_versions` | `id: String` | `name`, `slug`, `monthly_price`, `annual_price`, `currency`, `max_employees`, `max_projects`, `features` (JSONB), `is_active` |
| `subscriptions` | `id: UUID` | `company_id` (FK), `plan_version_id` (FK), `billing_interval`, `status`, `current_period_start`, `current_period_end`, `trial_ends_at` |
| `payments` | `id: String` | `company_id` (FK), `gateway`, `amount` (integer minor units), `currency`, `status`, `transaction_ref`, `idempotency_key`, `captured_at` |
| `support_tickets` | `id: String` | `company_id` (FK), `subject`, `priority`, `status`, `assigned_admin_id` (FK), `requester_email`, `sla_breached` |
| `ticket_messages` | `id: UUID` | `ticket_id` (FK), `author_id`, `author_role`, `is_internal_note` (boolean), `message_body`, `attachments` (JSONB) |
| `audit_logs` | `id: UUID` | `actor_id` (FK), `actor_email`, `actor_role`, `action`, `resource_type`, `resource_id`, `outcome`, `reason`, `changes` (JSONB redacted), `ip_address`, `created_at` |
| `system_settings` | `key: String` | `value` (JSONB), `is_secret` (boolean), `updated_by` (FK) |

---

## 18. Security & Privacy Standards

1. **Authentication Security**:
   - Passwords hashed using bcrypt / Argon2id with strong salt cost factors.
   - Access tokens are short-lived (15 minutes); refresh tokens are rotated on each use.
   - HttpOnly, Secure, SameSite=Lax/Strict cookie policies applied on all token cookies.
2. **Backend Enforcement**: Client role or UI visibility must never be trusted. Every controller performs server-side role and tenant-boundary authorization.
3. **Audit Trail Immutability**:
   - Write-only audit logging: No `UPDATE` or `DELETE` SQL grants on `audit_logs` table for regular application database roles.
   - Passwords, access tokens, webhook signing secrets, and credit card credentials must be strictly redacted before audit insertion.
4. **Data Isolation & Tenant Security**:
   - Direct database queries must enforce tenant separation (`WHERE company_id = :companyId`).
   - Cross-tenant data access attempts return 403 Forbidden and record security alerts.

---

## 19. Non-Functional Requirements (NFRs)

| Category | Standard & Acceptance Metric |
| :--- | :--- |
| **Read Latency** | Common read operations (dashboard summary, company list) target p95 < **500 ms** under baseline operational load. |
| **Page Load Time** | Initial dashboard interactive render target p95 < **3.0 seconds** over broadband connections. |
| **Availability** | **99.9%** monthly uptime commitment for the Super Admin control plane. |
| **Scalability** | Database queries must use indexed lookups; pagination enforced on all collections (default limit 20, max 100). |
| **Accessibility** | **WCAG 2.2 AA** standard compliance: minimum 4.5:1 text contrast, complete keyboard accessibility, screen-reader aria labels. |
| **Localization** | Unicode UTF-8 compliance supporting English and Bangla naming, multi-currency formatting (`BDT ৳`, `USD $`), and timezone-safe date displays. |
| **Disaster Recovery** | Automated daily database backups with tested point-in-time recovery (RPO < 1 hour, RTO < 4 hours). |

---

## 20. Formal Acceptance Criteria

- **AC-01**: Unauthenticated requests to any `/super-admin/*` route (excluding public auth screens) automatically redirect to `/super-admin/login`.
- **AC-02**: Public users cannot register Super Admin accounts through self-service web forms.
- **AC-03**: When 2FA is active, access to all dashboard pages is blocked until the 6-digit TOTP challenge is successfully verified.
- **AC-04**: An operator lacking `platform.companies.suspend` cannot suspend companies or alter tenant statuses.
- **AC-05**: Company suspensions require a documented reason and explicit confirmation; historical tenant data is preserved.
- **AC-06**: Company directory filters, search, and pagination are executed server-side to guarantee scalability.
- **AC-07**: Dashboard KPI counts and revenue metrics accurately reflect verified backend database records.
- **AC-08**: Payment records and refunds are confirmed through cryptographic webhook callbacks or direct gateway APIs, never client redirects alone.
- **AC-09**: Webhook handling is strictly idempotent; duplicate event deliveries do not trigger duplicate ledger adjustments.
- **AC-10**: Every sensitive action (suspension, plan change, refund, secret modification) generates an immutable audit record.
- **AC-11**: Audit logs, telemetry records, and exports never expose plaintext passwords, secret keys, or authentication tokens.
- **AC-12**: Third-party integration credentials remain masked in the UI and are never returned in browser network payloads.
- **AC-13**: Each data-driven screen provides loading skeletons, empty states, recoverable error states, and access-denied screens.
- **AC-14**: Cross-tenant data inspection is blocked and tested with automated unit and integration suites.
- **AC-15**: The entire administration interface is keyboard navigable and responsive across mobile, tablet, and desktop viewports.

---

## 21. Development Priority Roadmap

| Priority Tier | Deliverable Scope & Milestones |
| :---: | :--- |
| **P0 — Launch Blocker** | • Secure Login, Forgot/Reset Password, and 2FA Challenge.<br>• Dashboard overview with verified KPI metrics.<br>• Companies directory and Company Details view with suspension safeguards.<br>• Platform Admin Users, Roles & Permissions (RBAC) enforcement.<br>• Append-only Audit Logs.<br>• Session revocation and secure Logout flow. |
| **P0 — Billing Ready** | • Plans & Features catalog.<br>• Tenant Subscriptions lifecycle table.<br>• Payments transaction ledger, gateway webhooks, and refund flows. |
| **P1 — High Priority** | • Company Verification Queue (KYB review).<br>• Support Ticket desk with customer vs internal staff notes.<br>• Broadcast Announcements.<br>• System Health telemetry monitor.<br>• Background Jobs & Webhook logs with safe retry actions. |
| **P2 — Secondary Enhancements** | • Coupons & promotional discount management.<br>• Advanced analytics drill-downs.<br>• Bulk tenant export utilities. |

---

## 22. Developer Handoff Guidelines

1. **Frontend Architecture**:
   - Use Next.js (App Router) + TypeScript + Tailwind CSS.
   - Utilize existing UI components in `components/ui` and central HTTP methods in `lib/api-client.ts`.
   - Maintain uniform error handling using toast notifications (`react-toastify`) and modal safeguards (`components/ui/warning-modal.tsx`).
2. **Backend API Contracts**:
   - Backend APIs (Express.js + Prisma) must follow versioned schemas (`/api/v1/super-admin/...`).
   - Validate all request payloads using Zod schemas matching TypeScript definitions in `types/api.ts`.
3. **Database Migrations**:
   - Use Prisma schema migrations. Run and verify migrations against local PostgreSQL before deployment.
   - Do not commit mock or production customer credentials to version control.
4. **Tenant Isolation & Testing**:
   - Validate tenant separation in all multi-tenant queries.
   - Verify webhook idempotency using automated replay tests.

---

## Appendix A: Navigation Tree

```
Overview
└── Dashboard (/super-admin/dashboard)

Tenant Operations
├── Companies (/super-admin/companies)
├── Company Verification Queue (/super-admin/company-verifications)
└── Company Details (/super-admin/companies/[id])

SaaS Revenue
├── Subscriptions (/super-admin/subscriptions)
├── Plans & Features (/super-admin/plans)
├── Payments (/super-admin/payments)
└── Coupons & Trials (/super-admin/promotions)

Support
├── Support Tickets (/super-admin/tickets)
└── Announcements (/super-admin/announcements)

Platform Operations
├── Platform Users (/super-admin/admin-users)
├── Roles & Permissions (/super-admin/roles)
├── Audit Logs (/super-admin/audit-logs)
├── System Health (/super-admin/system-health)
└── Jobs & Webhooks (/super-admin/jobs-webhooks)

Configuration
├── Platform Settings (/super-admin/settings)
├── Integrations (/super-admin/integrations)
└── Security Settings (/super-admin/security)

Account
├── My Profile (/super-admin/profile)
└── Security & Sessions (/super-admin/profile/security)
```
