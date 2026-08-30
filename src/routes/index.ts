import { Router } from "express";
import productRoutes from "../services/product";
import authRoutes from "./auth.routes";

const router = Router();

router.use("/api/products", productRoutes)
router.use("/auth", authRoutes);

export default router;