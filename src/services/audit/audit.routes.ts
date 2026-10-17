import { Router } from "express";
import { AuditController } from "./audit.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Export audit logs (CSV / JSON)
router.get("/export", requirePermission("platform.audit.view"), AuditController.exportLogs);

// Cache audit logs queries for 15s
router.get("/", requirePermission("platform.audit.view"), cacheResponse({ ttlSeconds: 15, prefix: "audit" }), AuditController.getLogs);

export default router;

