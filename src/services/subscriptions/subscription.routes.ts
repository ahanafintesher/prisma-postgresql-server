import { Router } from "express";
import { SubscriptionController } from "./subscription.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Cache pricing plans for 5m and subscription listings for 30s
router.get("/plans", cacheResponse({ ttlSeconds: 300, prefix: "plans" }), SubscriptionController.getPlans);
router.post("/plans", requirePermission("platform.plans.manage"), SubscriptionController.createPlan);
router.patch("/plans/:id", requirePermission("platform.plans.manage"), SubscriptionController.updatePlan);
router.put("/plans/:id", requirePermission("platform.plans.manage"), SubscriptionController.updatePlan);

router.get("/", cacheResponse({ ttlSeconds: 30, prefix: "subscriptions" }), SubscriptionController.getSubscriptions);
router.post("/:id/change-plan", requirePermission("platform.subscriptions.manage"), SubscriptionController.changePlan);
router.post("/:id/extend-trial", requirePermission("platform.subscriptions.manage"), SubscriptionController.extendTrial);
router.post("/:id/cancel", requirePermission("platform.subscriptions.manage"), SubscriptionController.cancelSubscription);

export default router;

