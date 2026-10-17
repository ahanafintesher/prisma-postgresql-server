import { Router } from "express";
import { CompanyController } from "./company.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Cache company list for 30s and individual company profiles for 60s
router.get("/", cacheResponse({ ttlSeconds: 30, prefix: "companies" }), CompanyController.getCompanies);
router.get("/:id", cacheResponse({ ttlSeconds: 60, prefix: "companies" }), CompanyController.getCompanyById);
router.post("/", requirePermission("platform.companies.manage"), CompanyController.createCompany);
router.patch("/:id", requirePermission("platform.companies.manage"), CompanyController.updateCompany);
router.patch("/:id/status", requirePermission("platform.companies.suspend"), CompanyController.updateStatus);
router.post("/:id/suspend", requirePermission("platform.companies.suspend"), CompanyController.updateStatus);
router.post("/:id/reactivate", requirePermission("platform.companies.suspend"), CompanyController.reactivateCompany);
router.post("/:id/verify", requirePermission("platform.companies.verify"), CompanyController.verifyCompany);
router.post("/:id/reject", requirePermission("platform.companies.verify"), CompanyController.rejectCompany);
router.delete("/:id", requirePermission("platform.companies.manage"), CompanyController.deleteCompany);

export default router;

