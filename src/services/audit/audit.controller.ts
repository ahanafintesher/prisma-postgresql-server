import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { parsePaginationParams, sendPaginated } from "../../lib/pagination";

export class AuditController {
  static async getLogs(req: Request, res: Response) {
    try {
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 20,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "action", "resourceType", "actorEmail"],
      });

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
          take,
          orderBy: { [sortBy || "createdAt"]: sortOrder },
        }),
      ]);

      return sendPaginated(res, logs, total, page, limit);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve audit logs", 500);
    }
  }

  static async exportLogs(req: Request, res: Response) {
    try {
      const format = ((req.query.format as string) || "json").toLowerCase();
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

      const logs = await prisma.auditLog.findMany({
        where: whereClause,
        take: 1000,
        orderBy: { createdAt: "desc" },
      });

      if (format === "csv") {
        const headers = ["ID", "Actor Email", "Actor Role", "Action", "Resource Type", "Resource ID", "Outcome", "Reason", "IP Address", "Created At"];
        const rows = logs.map((log) => [
          `"${log.id}"`,
          `"${log.actorEmail || ""}"`,
          `"${log.actorRole || ""}"`,
          `"${log.action || ""}"`,
          `"${log.resourceType || ""}"`,
          `"${log.resourceId || ""}"`,
          `"${log.outcome || ""}"`,
          `"${(log.reason || "").replace(/"/g, '""')}"`,
          `"${log.ipAddress || ""}"`,
          `"${log.createdAt.toISOString()}"`,
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="audit_logs_export.csv"');
        return res.status(200).send(csvContent);
      }

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="audit_logs_export.json"');
      return sendSuccess(res, logs);
    } catch (error: any) {
      console.error("Export logs error:", error);
      return sendError(res, "Failed to export audit logs", 500);
    }
  }
}
