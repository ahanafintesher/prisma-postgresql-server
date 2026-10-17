import { Router } from "express";

import authRoutes from "../services/auth/auth.routes";
import dashboardRoutes from "../services/dashboard/dashboard.routes";
import companyRoutes from "../services/companies/company.routes";
import subscriptionRoutes from "../services/subscriptions/subscription.routes";
import paymentRoutes from "../services/payments/payment.routes";
import supportRoutes from "../services/support/support.routes";
import auditRoutes from "../services/audit/audit.routes";
import adminUsersRoutes from "../services/admin-users/admin-users.routes";
import rolesRoutes from "../services/roles/roles.routes";
import settingsRoutes from "../services/settings/settings.routes";

import { SubscriptionController } from "../services/subscriptions/subscription.controller";
import { PaymentController } from "../services/payments/payment.controller";
import { SupportController } from "../services/support/support.controller";
import { SettingsController } from "../services/settings/settings.controller";
import { authenticate, requirePermission } from "../middleware/auth.middleware";
import { cacheResponse } from "../middleware/cache.middleware";

const router = Router();

// -----------------------------------------------------------------------
// Dedicated Standalone Sub-Routers
// -----------------------------------------------------------------------

// Plans Router (for direct /plans and /api/v1/super-admin/plans)
const plansRouter = Router();
plansRouter.use(authenticate);
plansRouter.get("/", cacheResponse({ ttlSeconds: 300, prefix: "plans" }), SubscriptionController.getPlans);
plansRouter.post("/", requirePermission("platform.plans.manage"), SubscriptionController.createPlan);
plansRouter.patch("/:id", requirePermission("platform.plans.manage"), SubscriptionController.updatePlan);
plansRouter.put("/:id", requirePermission("platform.plans.manage"), SubscriptionController.updatePlan);

// Promotions Router (for direct /promotions and /api/v1/super-admin/promotions)
const promotionsRouter = Router();
promotionsRouter.use(authenticate);
promotionsRouter.get("/", cacheResponse({ ttlSeconds: 60, prefix: "promotions" }), PaymentController.getPromotions);
promotionsRouter.get("/coupons", cacheResponse({ ttlSeconds: 60, prefix: "promotions" }), PaymentController.getPromotions);
promotionsRouter.post("/", requirePermission("platform.payments.manage"), PaymentController.createPromotion);
promotionsRouter.patch("/:id", requirePermission("platform.payments.manage"), PaymentController.updatePromotion);
promotionsRouter.delete("/:id", requirePermission("platform.payments.manage"), PaymentController.deletePromotion);

// Announcements Router (for direct /announcements and /api/v1/super-admin/announcements)
const announcementsRouter = Router();
announcementsRouter.use(authenticate);
announcementsRouter.get("/", cacheResponse({ ttlSeconds: 30, prefix: "announcements" }), SupportController.getAnnouncements);
announcementsRouter.post("/", requirePermission("platform.announcements.manage"), SupportController.createAnnouncement);
announcementsRouter.patch("/:id", requirePermission("platform.announcements.manage"), SupportController.updateAnnouncement);
announcementsRouter.delete("/:id", requirePermission("platform.announcements.manage"), SupportController.deleteAnnouncement);

// Platform Telemetry & Governance Router
const telemetryRouter = Router();
telemetryRouter.get("/system-health", authenticate, cacheResponse({ ttlSeconds: 10, prefix: "health" }), SettingsController.getSystemHealth);
telemetryRouter.get("/health/services", authenticate, cacheResponse({ ttlSeconds: 10, prefix: "health" }), SettingsController.getHealthServices);
telemetryRouter.get("/jobs", authenticate, SettingsController.getJobs);
telemetryRouter.post("/jobs/:id/retry", authenticate, requirePermission("platform.settings.manage"), SettingsController.retryJob);
telemetryRouter.get("/webhooks", authenticate, SettingsController.getWebhooks);
telemetryRouter.get("/integrations", authenticate, SettingsController.getIntegrations);
telemetryRouter.post("/integrations/:id/test", authenticate, requirePermission("platform.settings.manage"), SettingsController.testIntegration);
telemetryRouter.get("/security-settings", authenticate, SettingsController.getSecurityPolicy);
telemetryRouter.get("/security-policy", authenticate, SettingsController.getSecurityPolicy);
telemetryRouter.patch("/security-policy", authenticate, requirePermission("platform.settings.manage"), SettingsController.updateSecurityPolicy);

// -----------------------------------------------------------------------
// 1. Direct routes matching BACKEND_INTEGRATION.md (NEXT_PUBLIC_API_URL)
// -----------------------------------------------------------------------
router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/companies", companyRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/plans", plansRouter);
router.use("/payments", paymentRoutes);
router.use("/promotions", promotionsRouter);
router.use("/support", supportRoutes);
router.use("/tickets", supportRoutes);
router.use("/announcements", announcementsRouter);
router.use("/users", adminUsersRoutes);
router.use("/admin-users", adminUsersRoutes);
router.use("/roles", rolesRoutes);
router.use("/logs", auditRoutes);
router.use("/audit-logs", auditRoutes);
router.use("/settings", settingsRoutes);
router.use("/", telemetryRouter);

// -----------------------------------------------------------------------
// 2. Standard /api prefix compatibility
// -----------------------------------------------------------------------
router.use("/api/auth", authRoutes);
router.use("/api/dashboard", dashboardRoutes);
router.use("/api/companies", companyRoutes);
router.use("/api/subscriptions", subscriptionRoutes);
router.use("/api/plans", plansRouter);
router.use("/api/payments", paymentRoutes);
router.use("/api/promotions", promotionsRouter);
router.use("/api/support", supportRoutes);
router.use("/api/tickets", supportRoutes);
router.use("/api/announcements", announcementsRouter);
router.use("/api/users", adminUsersRoutes);
router.use("/api/admin-users", adminUsersRoutes);
router.use("/api/roles", rolesRoutes);
router.use("/api/logs", auditRoutes);
router.use("/api/audit-logs", auditRoutes);
router.use("/api/settings", settingsRoutes);
router.use("/api", telemetryRouter);

// -----------------------------------------------------------------------
// 3. Versioned Super Admin routes matching requirements-final.md (/api/v1/super-admin/*)
// -----------------------------------------------------------------------
const v1Admin = Router();
v1Admin.use("/auth", authRoutes);
v1Admin.use("/dashboard", dashboardRoutes);
v1Admin.use("/companies", companyRoutes);
v1Admin.use("/plans", plansRouter);
v1Admin.use("/subscriptions", subscriptionRoutes);
v1Admin.use("/payments", paymentRoutes);
v1Admin.use("/promotions", promotionsRouter);
v1Admin.use("/tickets", supportRoutes);
v1Admin.use("/announcements", announcementsRouter);
v1Admin.use("/admin-users", adminUsersRoutes);
v1Admin.use("/users", adminUsersRoutes);
v1Admin.use("/roles", rolesRoutes);
v1Admin.use("/audit-logs", auditRoutes);
v1Admin.use("/logs", auditRoutes);
v1Admin.use("/settings", settingsRoutes);
v1Admin.use("/", telemetryRouter);

router.use("/api/v1/super-admin", v1Admin);

export default router;