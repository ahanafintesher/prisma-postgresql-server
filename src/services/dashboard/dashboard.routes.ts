import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/metrics", DashboardController.getMetrics);
router.get("/summary", DashboardController.getMetrics);
router.get("/activity", DashboardController.getActivity);

export default router;
