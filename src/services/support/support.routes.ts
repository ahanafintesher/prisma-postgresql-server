import { Router } from "express";
import { SupportController } from "./support.controller";
import { authenticate, requirePermission } from "../../middleware/auth.middleware";
import { cacheResponse } from "../../middleware/cache.middleware";

const router = Router();

router.use(authenticate);

// Announcements
router.get("/announcements", cacheResponse({ ttlSeconds: 30, prefix: "announcements" }), SupportController.getAnnouncements);
router.post("/announcements", requirePermission("platform.announcements.manage"), SupportController.createAnnouncement);
router.patch("/announcements/:id", requirePermission("platform.announcements.manage"), SupportController.updateAnnouncement);
router.delete("/announcements/:id", requirePermission("platform.announcements.manage"), SupportController.deleteAnnouncement);

// Tickets (Supports both /tickets/... and root /... when mounted directly at /tickets)
router.get("/tickets", cacheResponse({ ttlSeconds: 15, prefix: "tickets" }), SupportController.getTickets);
router.get("/tickets/:id", cacheResponse({ ttlSeconds: 30, prefix: "tickets" }), SupportController.getTicketById);
router.post("/tickets/:id/replies", requirePermission("platform.tickets.reply"), SupportController.addMessage);
router.post("/tickets/:id/notes", requirePermission("platform.tickets.notes"), SupportController.addMessage);
router.patch("/tickets/:id/status", SupportController.updateStatus);
router.patch("/tickets/:id", SupportController.updateStatus);
router.post("/tickets/:id/assign", requirePermission("platform.tickets.assign"), SupportController.assignTicket);

// Direct aliases for when mounted under /tickets
router.get("/", cacheResponse({ ttlSeconds: 15, prefix: "tickets" }), SupportController.getTickets);
router.get("/:id", cacheResponse({ ttlSeconds: 30, prefix: "tickets" }), SupportController.getTicketById);
router.post("/:id/replies", requirePermission("platform.tickets.reply"), SupportController.addMessage);
router.post("/:id/notes", requirePermission("platform.tickets.notes"), SupportController.addMessage);
router.patch("/:id/status", SupportController.updateStatus);
router.patch("/:id", SupportController.updateStatus);
router.post("/:id/assign", requirePermission("platform.tickets.assign"), SupportController.assignTicket);

export default router;

