import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";

export class DashboardController {
  static async getMetrics(req: Request, res: Response) {
    try {
      const [
        totalCompanies,
        activeCompanies,
        suspendedCompanies,
        pendingVerifications,
        revenueAggregate,
        openSupportTickets,
        activeSubscriptions,
      ] = await Promise.all([
        prisma.company.count(),
        prisma.company.count({ where: { status: "ACTIVE" } }),
        prisma.company.count({ where: { status: "SUSPENDED" } }),
        prisma.company.count({ where: { verificationStatus: "PENDING" } }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: "SUCCEEDED" },
        }),
        prisma.supportTicket.count({
          where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        }),
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
      ]);

      const totalRevenueCents = revenueAggregate._sum.amount || 0;

      const metrics = {
        totalCompanies,
        activeCompanies,
        suspendedCompanies,
        pendingVerifications,
        totalRevenue: Math.round(totalRevenueCents / 100), // formatted as standard currency units
        totalRevenueCents,
        openSupportTickets,
        activeSubscriptions,
        platformUptimePercentage: 99.98,
        activeNodes: 4,
      };

      return sendSuccess(res, metrics);
    } catch (error: any) {
      console.error("Dashboard metrics error:", error);
      return sendError(res, "Failed to retrieve dashboard metrics", 500);
    }
  }

  static async getActivity(req: Request, res: Response) {
    try {
      const recentAuditLogs = await prisma.auditLog.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
      });

      return sendSuccess(res, recentAuditLogs);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve activity feed", 500);
    }
  }
}
