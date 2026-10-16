import { Router } from "express";
import { SubscriptionController } from "./subscription.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/plans", SubscriptionController.getPlans);
router.get("/", SubscriptionController.getSubscriptions);
router.post("/:id/change-plan", requirePermission("platform.subscriptions.manage"), SubscriptionController.changePlan);
router.post("/:id/extend-trial", requirePermission("platform.subscriptions.manage"), SubscriptionController.extendTrial);

export default router;
