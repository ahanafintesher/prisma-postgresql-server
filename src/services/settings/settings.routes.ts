import { Router } from "express";
import { SettingsController } from "./settings.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// System health & Multi-Service Telemetry (cache for 10s)
router.get("/system-health", cacheResponse({ ttlSeconds: 10, prefix: "health" }), SettingsController.getSystemHealth);
router.get("/health/services", cacheResponse({ ttlSeconds: 10, prefix: "health" }), SettingsController.getHealthServices);

// Background Jobs and Webhooks
router.get("/jobs", SettingsController.getJobs);
router.post("/jobs/:id/retry", requirePermission("platform.settings.manage"), SettingsController.retryJob);
router.get("/webhooks", SettingsController.getWebhooks);

// Integrations
router.get("/integrations", SettingsController.getIntegrations);
router.post("/integrations/:id/test", requirePermission("platform.settings.manage"), SettingsController.testIntegration);

// Security Policy & Governance Settings
router.get("/security-settings", SettingsController.getSecurityPolicy);
router.get("/security-policy", SettingsController.getSecurityPolicy);
router.patch("/security-policy", requirePermission("platform.settings.manage"), SettingsController.updateSecurityPolicy);

// Platform Settings
router.get("/settings", cacheResponse({ ttlSeconds: 60, prefix: "settings" }), SettingsController.getSettings);
router.patch("/settings", requirePermission("platform.settings.manage"), SettingsController.updateSettings);

// Direct aliases for when mounted under /settings
router.get("/", cacheResponse({ ttlSeconds: 60, prefix: "settings" }), SettingsController.getSettings);
router.patch("/", requirePermission("platform.settings.manage"), SettingsController.updateSettings);

export default router;
