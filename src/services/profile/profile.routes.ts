import { Router } from "express";
import { ProfileController } from "./profile.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

// 1. Profile information & updates
router.get("/", authenticate, ProfileController.getProfile);
router.patch("/", authenticate, ProfileController.updateProfile);
router.patch("/password", authenticate, ProfileController.changePassword);

// 2. Two-Factor Authentication (TOTP)
router.post("/2fa/setup", authenticate, ProfileController.setup2FA);
router.post("/2fa/enable", authenticate, ProfileController.enable2FA);
router.post("/2fa/disable", authenticate, ProfileController.disable2FA);

// 3. Session Management (canonical /profile/sessions per Section 3.2)
router.get("/sessions", authenticate, ProfileController.getSessions);
router.delete("/sessions/:id", authenticate, ProfileController.revokeSession);
router.delete("/sessions", authenticate, ProfileController.revokeAllOtherSessions);

// 4. API Keys Management
router.get("/api-keys", authenticate, ProfileController.getApiKeys);
router.post("/api-keys", authenticate, ProfileController.createApiKey);
router.delete("/api-keys/:id", authenticate, ProfileController.revokeApiKey);

export default router;
