import { Router } from "express";
import productRoutes from "../services/product";
const router = Router();

router.use("/api/products", productRoutes)
export default router;