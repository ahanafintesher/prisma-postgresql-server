import { Router } from "express";
import { CompanyController } from "./company.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", CompanyController.getCompanies);
router.get("/:id", CompanyController.getCompanyById);
router.post("/", requirePermission("platform.companies.manage"), CompanyController.createCompany);
router.patch("/:id/status", requirePermission("platform.companies.suspend"), CompanyController.updateStatus);
router.post("/:id/suspend", requirePermission("platform.companies.suspend"), CompanyController.updateStatus);
router.post("/:id/verify", requirePermission("platform.companies.verify"), CompanyController.verifyCompany);

export default router;
