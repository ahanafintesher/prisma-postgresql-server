import { Router } from "express";
import { AuditController } from "./audit.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("platform.audit.view"), AuditController.getLogs);

export default router;
