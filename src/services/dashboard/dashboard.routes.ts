import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Cache metrics for 30s and activity/charts for 15s-60s
router.get("/metrics", cacheResponse({ ttlSeconds: 30, prefix: "dashboard" }), DashboardController.getMetrics);
router.get("/summary", cacheResponse({ ttlSeconds: 30, prefix: "dashboard" }), DashboardController.getMetrics);
router.get("/activity", cacheResponse({ ttlSeconds: 15, prefix: "dashboard" }), DashboardController.getActivity);
router.get("/charts", cacheResponse({ ttlSeconds: 60, prefix: "dashboard" }), DashboardController.getCharts);

export default router;

