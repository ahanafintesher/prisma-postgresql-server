import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { invalidateCacheCategory } from "../../lib/redis";
import { parsePaginationParams, sendPaginated } from "../../lib/pagination";

export class SupportController {
  static async getTickets(req: Request, res: Response) {
    try {
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "priority", "status", "subject", "slaBreached"],
      });

      const status = req.query.status as any;
      const priority = req.query.priority as any;
      const search = (req.query.search as string)?.trim() || "";

      const whereClause: any = {};

      if (status && status !== "ALL") {
        whereClause.status = status;
      }

      if (priority && priority !== "ALL") {
        whereClause.priority = priority;
      }

      if (search) {
        whereClause.OR = [
          { subject: { contains: search, mode: "insensitive" } },
          { requesterEmail: { contains: search, mode: "insensitive" } },
          { company: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [total, tickets] = await Promise.all([
        prisma.supportTicket.count({ where: whereClause }),
        prisma.supportTicket.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { [sortBy || "createdAt"]: sortOrder },
          include: {
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            assignedAdmin: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: { messages: true },
            },
          },
        }),
      ]);

      const formatted = tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        companyName: t.company.name,
        companySlug: t.company.slug,
        companyId: t.companyId,
        priority: t.priority,
        status: t.status,
        requesterEmail: t.requesterEmail,
        assignedAdmin: t.assignedAdmin?.name || "Unassigned",
        slaBreached: t.slaBreached,
        messageCount: t._count.messages,
        createdAt: t.createdAt,
      }));

      return sendPaginated(res, formatted, total, page, limit);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve support tickets", 500);
    }
  }

  static async getTicketById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        include: {
          company: true,
          assignedAdmin: true,
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!ticket) {
        return sendError(res, "Ticket not found", 404);
      }

      return sendSuccess(res, ticket);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve ticket details", 500);
    }
  }

  static async createTicket(req: Request, res: Response) {
    try {
      const { companyId, subject, description, message, priority, requesterEmail, assignedAdminId } = req.body;

      if (!companyId || !subject) {
        return sendError(res, "companyId and subject are required", 400, {
          ...(!companyId ? { companyId: ["Company ID is required"] } : {}),
          ...(!subject ? { subject: ["Subject is required"] } : {}),
        });
      }

      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
      const ticketPriority = priority && validPriorities.includes(String(priority).toUpperCase())
        ? (String(priority).toUpperCase() as any)
        : "MEDIUM";

      const ticket = await prisma.supportTicket.create({
        data: {
          companyId,
          subject: String(subject).trim(),
          priority: ticketPriority,
          status: "OPEN",
          requesterEmail: requesterEmail ? String(requesterEmail).trim() : company.ownerEmail,
          assignedAdminId: assignedAdminId || null,
          ...(description || message
            ? {
                messages: {
                  create: {
                    authorId: req.user?.id || "system",
                    authorRole: req.user?.roleSlug || "SUPER_ADMIN",
                    isInternalNote: false,
                    messageBody: String(description || message).trim(),
                  },
                },
              }
            : {}),
        },
        include: {
          company: {
            select: { id: true, name: true, slug: true, ownerEmail: true },
          },
          assignedAdmin: {
            select: { id: true, name: true, email: true },
          },
          messages: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "SUPPORT_TICKET_CREATED",
          resourceType: "SUPPORT_TICKET",
          resourceId: ticket.id,
          reason: `Created ticket: ${ticket.subject}`,
        },
      });

      await invalidateCacheCategory("tickets");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, ticket, undefined, "Support ticket created successfully", 201);
    } catch (error: any) {
      return sendError(res, "Failed to create support ticket", 500);
    }
  }

  static async addMessage(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { messageBody, isInternalNote, attachments } = req.body;

      if (!messageBody) {
        return sendError(res, "Message body is required", 400);
      }

      const ticket = await prisma.supportTicket.findUnique({ where: { id } });
      if (!ticket) {
        return sendError(res, "Ticket not found", 404);
      }

      const message = await prisma.ticketMessage.create({
        data: {
          ticketId: id,
          authorId: req.user?.id || "system",
          authorRole: req.user?.role || "SUPER_ADMIN",
          isInternalNote: Boolean(isInternalNote),
          messageBody,
          attachments: attachments || null,
        },
      });

      // Update ticket updated time
      await prisma.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      // Invalidate tickets and dashboard caches
      await invalidateCacheCategory("tickets");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, message, undefined, "Message posted successfully", 201);
    } catch (error: any) {
      return sendError(res, "Failed to post message", 500);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { status, priority, assignedAdminId } = req.body;

      const ticket = await prisma.supportTicket.findUnique({ where: { id } });
      if (!ticket) {
        return sendError(res, "Ticket not found", 404);
      }

      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
          ...(assignedAdminId !== undefined ? { assignedAdminId } : {}),
        },
      });

      // Invalidate tickets and dashboard caches
      await invalidateCacheCategory("tickets");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Ticket updated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to update ticket", 500);
    }
  }

  static async assignTicket(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { assignedAdminId } = req.body;

      if (!assignedAdminId) {
        return sendError(res, "assignedAdminId is required", 400);
      }

      const [ticket, admin] = await Promise.all([
        prisma.supportTicket.findUnique({ where: { id } }),
        prisma.platformAdmin.findUnique({ where: { id: assignedAdminId } }),
      ]);

      if (!ticket) {
        return sendError(res, "Ticket not found", 404);
      }
      if (!admin) {
        return sendError(res, "Admin user not found", 404);
      }

      const updated = await prisma.supportTicket.update({
        where: { id },
        data: { assignedAdminId },
        include: { assignedAdmin: true },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "TICKET_ASSIGNED",
          resourceType: "TICKET",
          resourceId: ticket.id,
          reason: `Assigned ticket '${ticket.subject}' to admin ${admin.name}`,
        },
      });

      await invalidateCacheCategory("tickets");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, `Ticket assigned to ${admin.name}`);
    } catch (error: any) {
      return sendError(res, "Failed to assign ticket", 500);
    }
  }

  static async getAnnouncements(req: Request, res: Response) {
    try {
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "title", "publishedAt", "expiresAt", "type"],
      });

      const type = req.query.type as any;
      const isPublished = req.query.isPublished !== undefined ? req.query.isPublished === "true" : undefined;
      const search = (req.query.search as string)?.trim() || "";

      const whereClause: any = {};
      if (type && type !== "ALL") whereClause.type = type;
      if (isPublished !== undefined) whereClause.isPublished = isPublished;
      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, announcements] = await Promise.all([
        prisma.announcement.count({ where: whereClause }),
        prisma.announcement.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { [sortBy || "createdAt"]: sortOrder },
        }),
      ]);

      return sendPaginated(res, announcements, total, page, limit);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve announcements", 500);
    }
  }

  static async createAnnouncement(req: Request, res: Response) {
    try {
      const {
        title,
        content,
        type = "INFO",
        targetAudience = "ALL",
        isPublished = false,
        expiresAt,
      } = req.body;

      if (!title || !content) {
        return sendError(res, "Title and content are required", 400);
      }

      const announcement = await prisma.announcement.create({
        data: {
          title,
          content,
          type,
          targetAudience,
          isPublished: Boolean(isPublished),
          publishedAt: isPublished ? new Date() : null,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "ANNOUNCEMENT_CREATED",
          resourceType: "ANNOUNCEMENT",
          resourceId: announcement.id,
          reason: `Broadcast announcement created: ${announcement.title}`,
        },
      });

      await invalidateCacheCategory("announcements");

      return sendSuccess(res, announcement, undefined, "Announcement created successfully", 201);
    } catch (error: any) {
      return sendError(res, "Failed to create announcement", 500);
    }
  }

  static async updateAnnouncement(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { title, content, type, targetAudience, isPublished, expiresAt } = req.body;

      const existing = await prisma.announcement.findUnique({ where: { id } });
      if (!existing) {
        return sendError(res, "Announcement not found", 404);
      }

      const publishedStatusChanged = isPublished !== undefined && Boolean(isPublished) !== existing.isPublished;

      const updated = await prisma.announcement.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(type !== undefined ? { type } : {}),
          ...(targetAudience !== undefined ? { targetAudience } : {}),
          ...(isPublished !== undefined ? { isPublished: Boolean(isPublished) } : {}),
          ...(publishedStatusChanged && isPublished ? { publishedAt: new Date() } : {}),
          ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
        },
      });

      await invalidateCacheCategory("announcements");

      return sendSuccess(res, updated, undefined, "Announcement updated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to update announcement", 500);
    }
  }

  static async deleteAnnouncement(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const existing = await prisma.announcement.findUnique({ where: { id } });
      if (!existing) {
        return sendError(res, "Announcement not found", 404);
      }

      await prisma.announcement.delete({ where: { id } });

      await invalidateCacheCategory("announcements");

      return sendSuccess(res, { id }, undefined, "Announcement deleted successfully");
    } catch (error: any) {
      return sendError(res, "Failed to delete announcement", 500);
    }
  }
}
