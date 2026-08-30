import { Router } from "express";
import productRoutes from "../services/product";
import authRoutes from "./auth.routes";
import userRoutes from "../services/user/user.routes";

const router = Router();

router.use("/api/products", productRoutes)
router.use("/auth", authRoutes);
router.use("/api/users", userRoutes)

export default router;