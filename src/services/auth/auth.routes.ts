import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.post("/login", AuthController.login);
router.post("/verify-2fa", AuthController.verify2FA);
router.post("/refresh", AuthController.refresh);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);
router.get("/me", authenticate, AuthController.me);
router.post("/logout", authenticate, AuthController.logout);

// Session Security Management (BACKEND_INTEGRATION.md & improvements.md)
router.get("/sessions", authenticate, AuthController.getSessions);
router.delete("/sessions/:id", authenticate, AuthController.revokeSession);
router.delete("/sessions", authenticate, AuthController.revokeAllOtherSessions);
router.post("/revoke-other-sessions", authenticate, AuthController.revokeAllOtherSessions);

export default router;

