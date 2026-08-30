import { Router } from "express";
import { getProfile } from "./user.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.get("/profile", authenticate, getProfile);

export default router;