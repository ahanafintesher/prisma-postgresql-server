import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";

export class SubscriptionController {
  static async getPlans(req: Request, res: Response) {
    try {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        include: {
          versions: {
            where: { isActive: true },
            orderBy: { version: "desc" },
            take: 1,
          },
        },
        orderBy: { monthlyPrice: "asc" },
      });

      return sendSuccess(res, plans);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve plans", 500);
    }
  }

  static async getSubscriptions(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const skip = (page - 1) * limit;

      const status = req.query.status as any;
      const whereClause: any = {};
      if (status && status !== "ALL") {
        whereClause.status = status;
      }

      const [total, subscriptions] = await Promise.all([
        prisma.subscription.count({ where: whereClause }),
        prisma.subscription.findMany({
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
                ownerEmail: true,
                status: true,
              },
            },
            planVersion: {
              include: {
                plan: true,
              },
            },
          },
        }),
      ]);

      return sendSuccess(res, subscriptions, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error: any) {
      return sendError(res, "Failed to retrieve subscriptions", 500);
    }
  }

  static async changePlan(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { newPlanVersionId, billingInterval } = req.body;

      if (!newPlanVersionId) {
        return sendError(res, "newPlanVersionId is required", 400);
      }

      const subscription = await prisma.subscription.findUnique({
        where: { id },
        include: {
          planVersion: { include: { plan: true } },
          company: true,
        },
      });

      if (!subscription) {
        return sendError(res, "Subscription not found", 404);
      }

      const targetVersion = await prisma.planVersion.findUnique({
        where: { id: newPlanVersionId },
        include: { plan: true },
      });

      if (!targetVersion) {
        return sendError(res, "Target plan version not found", 404);
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          planVersionId: newPlanVersionId,
          ...(billingInterval ? { billingInterval } : {}),
        },
        include: {
          company: true,
          planVersion: { include: { plan: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "SUBSCRIPTION_PLAN_CHANGED",
          resourceType: "SUBSCRIPTION",
          resourceId: subscription.id,
          reason: `Changed plan for ${subscription.company.name} from ${subscription.planVersion.plan.name} to ${targetVersion.plan.name}`,
          changes: {
            previousPlan: subscription.planVersion.plan.name,
            newPlan: targetVersion.plan.name,
            previousVersionId: subscription.planVersionId,
            newVersionId: newPlanVersionId,
          },
        },
      });

      return sendSuccess(res, updated, undefined, "Subscription plan updated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to change subscription plan", 500);
    }
  }

  static async extendTrial(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { additionalDays } = req.body;

      const days = parseInt(additionalDays) || 14;
      const subscription = await prisma.subscription.findUnique({
        where: { id },
        include: { company: true },
      });

      if (!subscription) {
        return sendError(res, "Subscription not found", 404);
      }

      const currentTrialEnd = subscription.trialEndsAt || new Date();
      const newTrialEnd = new Date(currentTrialEnd);
      newTrialEnd.setDate(newTrialEnd.getDate() + days);

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          trialEndsAt: newTrialEnd,
          status: "TRIALING",
        },
        include: { company: true },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "SUBSCRIPTION_TRIAL_EXTENDED",
          resourceType: "SUBSCRIPTION",
          resourceId: subscription.id,
          reason: `Extended trial for ${subscription.company.name} by ${days} days`,
        },
      });

      return sendSuccess(res, updated, undefined, `Trial extended by ${days} days`);
    } catch (error: any) {
      return sendError(res, "Failed to extend trial", 500);
    }
  }
}
