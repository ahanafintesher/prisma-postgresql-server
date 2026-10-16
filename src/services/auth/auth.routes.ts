import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.get("/me", authenticate, AuthController.me);
router.post("/logout", authenticate, AuthController.logout);

export default router;
