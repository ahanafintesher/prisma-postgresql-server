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

  static async getCharts(req: Request, res: Response) {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [recentCompanies, recentPayments] = await Promise.all([
        prisma.company.findMany({
          where: { createdAt: { gte: sixMonthsAgo } },
          select: { createdAt: true },
        }),
        prisma.payment.findMany({
          where: {
            status: "SUCCEEDED",
            createdAt: { gte: sixMonthsAgo },
          },
          select: { amount: true, createdAt: true },
        }),
      ]);

      // Bucket data into the 6 months
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const series: Array<{
        month: string;
        year: number;
        label: string;
        companiesRegistered: number;
        revenue: number;
        revenueCents: number;
      }> = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const label = `${monthNames[m]} ${y}`;

        const monthCompanies = recentCompanies.filter((c) => {
          const cd = new Date(c.createdAt);
          return cd.getFullYear() === y && cd.getMonth() === m;
        }).length;

        const monthRevenueCents = recentPayments
          .filter((p) => {
            const pd = new Date(p.createdAt);
            return pd.getFullYear() === y && pd.getMonth() === m;
          })
          .reduce((sum, p) => sum + p.amount, 0);

        series.push({
          month: monthNames[m],
          year: y,
          label,
          companiesRegistered: monthCompanies,
          revenue: Math.round(monthRevenueCents / 100),
          revenueCents: monthRevenueCents,
        });
      }

      return sendSuccess(res, {
        timeframe: "Last 6 Months",
        data: series,
      });
    } catch (error) {
      return sendError(res, "Failed to generate dashboard analytics charts", 500);
    }
  }
}

