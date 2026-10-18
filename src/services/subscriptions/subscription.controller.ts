import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { invalidateCacheCategory } from "../../lib/redis";
import { parsePaginationParams, sendPaginated } from "../../lib/pagination";

export class SubscriptionController {
  static async getPlans(req: Request, res: Response) {
    try {
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.pageSize !== undefined;
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 20,
        maxLimit: 100,
        defaultSortBy: "monthlyPrice",
        defaultSortOrder: "asc",
        allowedSortFields: ["monthlyPrice", "annualPrice", "name", "slug", "createdAt"],
      });

      const whereClause = { isActive: true };

      if (isPaginated) {
        const [total, plans] = await Promise.all([
          prisma.plan.count({ where: whereClause }),
          prisma.plan.findMany({
            where: whereClause,
            skip,
            take,
            include: {
              versions: {
                where: { isActive: true },
                orderBy: { version: "desc" },
                take: 1,
              },
            },
            orderBy: { [sortBy || "monthlyPrice"]: sortOrder },
          }),
        ]);

        return sendPaginated(res, plans, total, page, limit);
      }

      const plans = await prisma.plan.findMany({
        where: whereClause,
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
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "status", "currentPeriodEnd", "currentPeriodStart"],
      });

      const status = req.query.status as any;
      const search = (req.query.search as string)?.trim() || "";

      const whereClause: any = {};
      if (status && status !== "ALL") {
        whereClause.status = status;
      }
      if (search) {
        whereClause.company = {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { ownerEmail: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      const [total, subscriptions] = await Promise.all([
        prisma.subscription.count({ where: whereClause }),
        prisma.subscription.findMany({
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

      return sendPaginated(res, subscriptions, total, page, limit);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve subscriptions", 500);
    }
  }

  static async getSubscriptionById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const subscription = await prisma.subscription.findUnique({
        where: { id },
        include: {
          company: true,
          planVersion: {
            include: { plan: true },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!subscription) {
        return sendError(res, "Subscription not found", 404);
      }

      return sendSuccess(res, subscription);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve subscription detail", 500);
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

      // Invalidate subscription and dashboard caches
      await invalidateCacheCategory("subscriptions");
      await invalidateCacheCategory("dashboard");

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

      // Invalidate subscription and dashboard caches
      await invalidateCacheCategory("subscriptions");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, `Trial extended by ${days} days`);
    } catch (error: any) {
      return sendError(res, "Failed to extend trial", 500);
    }
  }

  static async createPlan(req: Request, res: Response) {
    try {
      const {
        name,
        slug,
        description,
        monthlyPrice,
        annualPrice,
        currency = "USD",
        maxEmployees,
        maxProjects,
        features = [],
      } = req.body;

      if (!name || !slug) {
        return sendError(res, "Plan name and slug are required", 400);
      }

      const existing = await prisma.plan.findUnique({ where: { slug } });
      if (existing) {
        return sendError(res, `Plan slug '${slug}' is already taken`, 409);
      }

      const mPrice = typeof monthlyPrice === "number" ? monthlyPrice : parseInt(monthlyPrice) || 0;
      const aPrice = typeof annualPrice === "number" ? annualPrice : parseInt(annualPrice) || 0;
      const employees = typeof maxEmployees === "number" ? maxEmployees : parseInt(maxEmployees) || 10;
      const projects = typeof maxProjects === "number" ? maxProjects : parseInt(maxProjects) || 5;

      const plan = await prisma.plan.create({
        data: {
          name,
          slug,
          description: description || null,
          monthlyPrice: mPrice,
          annualPrice: aPrice,
          currency,
          maxEmployees: employees,
          maxProjects: projects,
          features: Array.isArray(features) ? features : [features],
          versions: {
            create: {
              version: 1,
              monthlyPrice: mPrice,
              annualPrice: aPrice,
              currency,
              maxEmployees: employees,
              maxProjects: projects,
              features: Array.isArray(features) ? features : [features],
              isActive: true,
            },
          },
        },
        include: {
          versions: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "PLAN_CREATED",
          resourceType: "PLAN",
          resourceId: plan.id,
          reason: `Created pricing plan tier '${plan.name}'`,
        },
      });

      await invalidateCacheCategory("plans");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, plan, undefined, "Plan created successfully", 201);
    } catch (error: any) {
      console.error("Create plan error:", error);
      return sendError(res, "Failed to create plan", 500);
    }
  }

  static async updatePlan(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const {
        name,
        description,
        monthlyPrice,
        annualPrice,
        currency,
        maxEmployees,
        maxProjects,
        features,
        isActive,
      } = req.body;

      const existingPlan = await prisma.plan.findUnique({
        where: { id },
        include: {
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
      });

      if (!existingPlan) {
        return sendError(res, "Plan not found", 404);
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (monthlyPrice !== undefined) updateData.monthlyPrice = parseInt(monthlyPrice);
      if (annualPrice !== undefined) updateData.annualPrice = parseInt(annualPrice);
      if (currency !== undefined) updateData.currency = currency;
      if (maxEmployees !== undefined) updateData.maxEmployees = parseInt(maxEmployees);
      if (maxProjects !== undefined) updateData.maxProjects = parseInt(maxProjects);
      if (features !== undefined) updateData.features = Array.isArray(features) ? features : [features];
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      const updatedPlan = await prisma.plan.update({
        where: { id },
        data: updateData,
        include: {
          versions: { orderBy: { version: "desc" }, take: 1 },
        },
      });

      // If pricing or limits changed, snapshot into latest or new plan version
      if (
        monthlyPrice !== undefined ||
        annualPrice !== undefined ||
        maxEmployees !== undefined ||
        maxProjects !== undefined ||
        features !== undefined
      ) {
        const latestVersion = existingPlan.versions[0];
        const nextVersionNumber = (latestVersion?.version || 1) + 1;

        await prisma.planVersion.create({
          data: {
            planId: existingPlan.id,
            version: nextVersionNumber,
            monthlyPrice: updatedPlan.monthlyPrice,
            annualPrice: updatedPlan.annualPrice,
            currency: updatedPlan.currency,
            maxEmployees: updatedPlan.maxEmployees,
            maxProjects: updatedPlan.maxProjects,
            features: updatedPlan.features as any,
            isActive: updatedPlan.isActive,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "PLAN_UPDATED",
          resourceType: "PLAN",
          resourceId: existingPlan.id,
          reason: `Updated plan parameters for '${existingPlan.name}'`,
          changes: {
            before: { name: existingPlan.name, monthlyPrice: existingPlan.monthlyPrice },
            after: { name: updatedPlan.name, monthlyPrice: updatedPlan.monthlyPrice },
          },
        },
      });

      await invalidateCacheCategory("plans");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updatedPlan, undefined, "Plan updated successfully");
    } catch (error: any) {
      console.error("Update plan error:", error);
      return sendError(res, "Failed to update plan", 500);
    }
  }

  static async cancelSubscription(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body || {};

      const subscription = await prisma.subscription.findUnique({
        where: { id },
        include: { company: true, planVersion: { include: { plan: true } } },
      });

      if (!subscription) {
        return sendError(res, "Subscription not found", 404);
      }

      const updated = await prisma.subscription.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
        include: { company: true, planVersion: { include: { plan: true } } },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "SUBSCRIPTION_CANCELLED",
          resourceType: "SUBSCRIPTION",
          resourceId: subscription.id,
          reason: reason || `Cancelled subscription for ${subscription.company.name}`,
          changes: {
            previousStatus: subscription.status,
            newStatus: "CANCELLED",
          },
        },
      });

      await invalidateCacheCategory("subscriptions");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Subscription cancelled successfully");
    } catch (error: any) {
      return sendError(res, "Failed to cancel subscription", 500);
    }
  }
}
