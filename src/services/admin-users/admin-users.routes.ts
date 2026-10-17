import { Router } from "express";
import { AdminUsersController } from "./admin-users.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Cache admin users listing for 30s
router.get("/", cacheResponse({ ttlSeconds: 30, prefix: "admin_users" }), AdminUsersController.getAdminUsers);
router.get("/:id", cacheResponse({ ttlSeconds: 60, prefix: "admin_users" }), AdminUsersController.getAdminUserById);
router.post("/", requirePermission("platform.admins.manage"), AdminUsersController.createAdminUser);
router.patch("/:id", requirePermission("platform.admins.manage"), AdminUsersController.updateAdminUser);
router.patch("/:id/status", requirePermission("platform.admins.manage"), AdminUsersController.updateStatus);
router.delete("/:id", requirePermission("platform.admins.manage"), AdminUsersController.deleteAdminUser);

export default router;
