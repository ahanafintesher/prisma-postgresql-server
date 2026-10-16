import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";

export class SupportController {
  static async getTickets(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const skip = (page - 1) * limit;

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
          take: limit,
          orderBy: { createdAt: "desc" },
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

      return sendSuccess(res, formatted, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
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

      return sendSuccess(res, updated, undefined, "Ticket updated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to update ticket", 500);
    }
  }
}
