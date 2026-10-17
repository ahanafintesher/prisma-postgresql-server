import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Cache payment list for 30s and individual transaction details for 60s
router.get("/promotions", cacheResponse({ ttlSeconds: 60, prefix: "promotions" }), PaymentController.getPromotions);
router.post("/promotions", requirePermission("platform.payments.manage"), PaymentController.createPromotion);
router.patch("/promotions/:id", requirePermission("platform.payments.manage"), PaymentController.updatePromotion);
router.delete("/promotions/:id", requirePermission("platform.payments.manage"), PaymentController.deletePromotion);

router.get("/", cacheResponse({ ttlSeconds: 30, prefix: "payments" }), PaymentController.getPayments);
router.get("/:id", cacheResponse({ ttlSeconds: 60, prefix: "payments" }), PaymentController.getPaymentById);
router.post("/:id/refund", requirePermission("platform.payments.refund"), PaymentController.issueRefund);
router.post("/:id/reconcile", requirePermission("platform.payments.manage"), PaymentController.reconcilePayment);

export default router;

