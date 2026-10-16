import { Router } from "express";

import authRoutes from "../services/auth/auth.routes";
import dashboardRoutes from "../services/dashboard/dashboard.routes";
import companyRoutes from "../services/companies/company.routes";
import subscriptionRoutes from "../services/subscriptions/subscription.routes";
import paymentRoutes from "../services/payments/payment.routes";
import supportRoutes from "../services/support/support.routes";
import auditRoutes from "../services/audit/audit.routes";

const router = Router();

// -----------------------------------------------------------------------
// 1. Direct routes matching BACKEND_INTEGRATION.md (NEXT_PUBLIC_API_URL)
// -----------------------------------------------------------------------
router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/companies", companyRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/payments", paymentRoutes);
router.use("/support", supportRoutes);
router.use("/logs", auditRoutes);

// -----------------------------------------------------------------------
// 2. Standard /api prefix compatibility
// -----------------------------------------------------------------------
router.use("/api/auth", authRoutes);
router.use("/api/dashboard", dashboardRoutes);
router.use("/api/companies", companyRoutes);
router.use("/api/subscriptions", subscriptionRoutes);
router.use("/api/payments", paymentRoutes);
router.use("/api/support", supportRoutes);
router.use("/api/logs", auditRoutes);

// -----------------------------------------------------------------------
// 3. Versioned Super Admin routes matching requirements-final.md (/api/v1/super-admin/*)
// -----------------------------------------------------------------------
const v1Admin = Router();
v1Admin.use("/auth", authRoutes);
v1Admin.use("/dashboard", dashboardRoutes);
v1Admin.use("/companies", companyRoutes);
v1Admin.use("/plans", subscriptionRoutes);
v1Admin.use("/subscriptions", subscriptionRoutes);
v1Admin.use("/payments", paymentRoutes);
v1Admin.use("/tickets", supportRoutes);
v1Admin.use("/audit-logs", auditRoutes);

router.use("/api/v1/super-admin", v1Admin);

export default router;