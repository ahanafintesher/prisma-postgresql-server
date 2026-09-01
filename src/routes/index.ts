import { Router } from "express";
import productRoutes from "../services/product";
import authRoutes from "./auth.routes";
import userRoutes from "../services/user/user.routes";
import categoryRoutes from "../services/categories/category.routes";

const router = Router();

router.use("/api/products", productRoutes)
router.use("/auth", authRoutes);
router.use("/api/users", userRoutes)
router.use("/api/categories", categoryRoutes)

export default router;