import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";

export class AuditController {
  static async getLogs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const skip = (page - 1) * limit;

      const search = (req.query.search as string)?.trim() || "";
      const resourceType = req.query.resourceType as string;
      const action = req.query.action as string;

      const whereClause: any = {};

      if (resourceType && resourceType !== "ALL") {
        whereClause.resourceType = resourceType;
      }

      if (action && action !== "ALL") {
        whereClause.action = action;
      }

      if (search) {
        whereClause.OR = [
          { actorEmail: { contains: search, mode: "insensitive" } },
          { action: { contains: search, mode: "insensitive" } },
          { reason: { contains: search, mode: "insensitive" } },
          { resourceId: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where: whereClause }),
        prisma.auditLog.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return sendSuccess(res, logs, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      return sendError(res, "Failed to retrieve audit logs", 500);
    }
  }
}
