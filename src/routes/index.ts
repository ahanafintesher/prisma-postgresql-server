import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "../services/user/user.routes";
import categoryRoutes from "../services/categories/category.routes";
import productRoutes from "../services/product/product.routes";
const router = Router();

router.use("/auth", authRoutes);
router.use("/api/users", userRoutes)
router.use("/api/categories", categoryRoutes)
router.use("/products", productRoutes);

export default router;