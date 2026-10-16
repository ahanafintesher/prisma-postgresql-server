import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", PaymentController.getPayments);
router.get("/:id", PaymentController.getPaymentById);
router.post("/:id/refund", requirePermission("platform.payments.refund"), PaymentController.issueRefund);

export default router;
