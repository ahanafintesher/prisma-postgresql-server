import { Router } from "express";
import { SupportController } from "./support.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/tickets", SupportController.getTickets);
router.get("/tickets/:id", SupportController.getTicketById);
router.post("/tickets/:id/replies", requirePermission("platform.tickets.reply"), SupportController.addMessage);
router.post("/tickets/:id/notes", requirePermission("platform.tickets.notes"), SupportController.addMessage);
router.patch("/tickets/:id/status", SupportController.updateStatus);

export default router;
