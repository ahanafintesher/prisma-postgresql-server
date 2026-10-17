import { Router } from "express";
import { RolesController } from "./roles.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Cache roles listing for 60s and permissions list for 5m
router.get("/permissions", cacheResponse({ ttlSeconds: 300, prefix: "roles" }), RolesController.getPermissions);
router.get("/", cacheResponse({ ttlSeconds: 60, prefix: "roles" }), RolesController.getRoles);
router.get("/:id", cacheResponse({ ttlSeconds: 60, prefix: "roles" }), RolesController.getRoleById);
router.post("/", requirePermission("platform.roles.manage"), RolesController.createRole);
router.patch("/:id", requirePermission("platform.roles.manage"), RolesController.updateRole);
router.delete("/:id", requirePermission("platform.roles.manage"), RolesController.deleteRole);

export default router;
