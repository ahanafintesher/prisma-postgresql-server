import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { invalidateCacheCategory } from "../../lib/redis";
import { parsePaginationParams, sendPaginated } from "../../lib/pagination";

export class CompanyController {
  static async getCompanies(req: Request, res: Response) {
    try {
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "name", "slug", "ownerEmail", "status", "verificationStatus"],
      });

      const search = (req.query.search as string)?.trim() || "";
      const status = req.query.status as any;
      const verificationStatus = req.query.verificationStatus as any;

      const whereClause: any = {};

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
          { ownerEmail: { contains: search, mode: "insensitive" } },
        ];
      }

      if (status && status !== "ALL") {
        whereClause.status = status;
      }

      if (verificationStatus && verificationStatus !== "ALL") {
        whereClause.verificationStatus = verificationStatus;
      }

      const [total, companies] = await Promise.all([
        prisma.company.count({ where: whereClause }),
        prisma.company.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { [sortBy || "createdAt"]: sortOrder },
          include: {
            subscriptions: {
              where: { status: "ACTIVE" },
              include: {
                planVersion: {
                  include: { plan: true },
                },
              },
              take: 1,
            },
            _count: {
              select: {
                supportTickets: true,
                payments: true,
              },
            },
          },
        }),
      ]);

      const formattedCompanies = companies.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        ownerEmail: c.ownerEmail,
        status: c.status,
        verificationStatus: c.verificationStatus,
        verifiedAt: c.verifiedAt,
        suspensionReason: c.suspensionReason,
        activePlan: c.subscriptions[0]?.planVersion?.plan?.name || "Free Trial",
        createdAt: c.createdAt,
        ticketCount: c._count.supportTickets,
        paymentCount: c._count.payments,
      }));

      return sendPaginated(res, formattedCompanies, total, page, limit);
    } catch (error: any) {
      console.error("Get companies error:", error);
      return sendError(res, "Failed to retrieve companies", 500);
    }
  }

  static async getCompanyById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          subscriptions: {
            include: {
              planVersion: {
                include: { plan: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          payments: {
            take: 10,
            orderBy: { createdAt: "desc" },
          },
          supportTickets: {
            take: 5,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      return sendSuccess(res, company);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve company details", 500);
    }
  }

  static async createCompany(req: Request, res: Response) {
    try {
      const { name, slug, ownerEmail, initialPlanId } = req.body;

      if (!name || !slug || !ownerEmail) {
        return sendError(res, "Name, slug, and ownerEmail are required", 400);
      }

      const existingSlug = await prisma.company.findUnique({ where: { slug } });
      if (existingSlug) {
        return sendError(res, `Company slug '${slug}' is already taken`, 409);
      }

      const company = await prisma.company.create({
        data: {
          name,
          slug,
          ownerEmail,
          status: "ACTIVE",
          verificationStatus: "UNVERIFIED",
        },
      });

      // Assign initial subscription if plan specified
      if (initialPlanId) {
        const planVersion = await prisma.planVersion.findFirst({
          where: { planId: initialPlanId, isActive: true },
          orderBy: { version: "desc" },
        });

        if (planVersion) {
          const periodEnd = new Date();
          periodEnd.setDate(periodEnd.getDate() + 30);

          await prisma.subscription.create({
            data: {
              companyId: company.id,
              planVersionId: planVersion.id,
              billingInterval: "MONTHLY",
              status: "ACTIVE",
              currentPeriodStart: new Date(),
              currentPeriodEnd: periodEnd,
            },
          });
        }
      }

      // Audit Log
      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "COMPANY_CREATED",
          resourceType: "COMPANY",
          resourceId: company.id,
          reason: `Provisioned company ${company.name}`,
        },
      });

      // Invalidate companies and dashboard caches
      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, company, undefined, "Company created successfully", 201);
    } catch (error: any) {
      console.error("Create company error:", error);
      return sendError(res, "Failed to create company", 500);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { status, reason } = req.body;

      if (!status) {
        return sendError(res, "Status is required", 400);
      }

      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      if (company.status === status) {
        return sendError(res, `Tenant is already ${status.toLowerCase()}`, 409, {
          status: [`Cannot transition from ${company.status} to ${status}`],
        });
      }

      // If suspending, require reason per AC-05 in requirements-final.md
      if (status === "SUSPENDED" && !reason) {
        return sendError(res, "Documented reason is mandatory when suspending a company", 400);
      }

      const updated = await prisma.company.update({
        where: { id },
        data: {
          status,
          suspensionReason: status === "SUSPENDED" ? reason : null,
          suspendedAt: status === "SUSPENDED" ? new Date() : null,
        },
      });

      // Record immutable audit log
      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: status === "SUSPENDED" ? "COMPANY_SUSPENDED" : `COMPANY_STATUS_${status}`,
          resourceType: "COMPANY",
          resourceId: company.id,
          reason: reason || `Updated company status to ${status}`,
          changes: {
            previousStatus: company.status,
            newStatus: status,
          },
        },
      });

      // Invalidate companies and dashboard caches
      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, `Company status updated to ${status}`);
    } catch (error: any) {
      return sendError(res, "Failed to update company status", 500);
    }
  }

  static async verifyCompany(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { approved, rejectionReason } = req.body;

      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      const verificationStatus = approved ? "VERIFIED" : "REJECTED";
      const updated = await prisma.company.update({
        where: { id },
        data: {
          verificationStatus,
          verifiedAt: approved ? new Date() : null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: approved ? "COMPANY_VERIFIED" : "COMPANY_VERIFICATION_REJECTED",
          resourceType: "COMPANY",
          resourceId: company.id,
          reason: rejectionReason || (approved ? "KYB documentation verified" : "Rejected verification"),
        },
      });

      // Invalidate companies and dashboard caches
      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, `Company verification status set to ${verificationStatus}`);
    } catch (error: any) {
      return sendError(res, "Failed to process verification", 500);
    }
  }

  static async extendTrial(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { days, reason } = req.body;

      if (!days || Number(days) <= 0 || !reason) {
        return sendError(res, "days (positive number) and reason are required", 400, {
          ...((!days || Number(days) <= 0) ? { days: ["Days must be a positive integer"] } : {}),
          ...(!reason ? { reason: ["Documented reason is mandatory"] } : {}),
        });
      }

      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      let subscription = company.subscriptions[0];
      let newTrialEndsAt: Date;

      if (subscription) {
        const baseDate = subscription.trialEndsAt && subscription.trialEndsAt > new Date()
          ? new Date(subscription.trialEndsAt)
          : new Date();
        newTrialEndsAt = new Date(baseDate.getTime() + Number(days) * 86400 * 1000);

        subscription = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            trialEndsAt: newTrialEndsAt,
            currentPeriodEnd: newTrialEndsAt,
            status: "TRIALING",
          },
        });
      } else {
        const defaultPlanVersion = await prisma.planVersion.findFirst({
          where: { isActive: true },
          orderBy: { version: "desc" },
        });

        if (!defaultPlanVersion) {
          return sendError(res, "No active pricing plan available to create trial", 500);
        }

        newTrialEndsAt = new Date(Date.now() + Number(days) * 86400 * 1000);
        subscription = await prisma.subscription.create({
          data: {
            companyId: company.id,
            planVersionId: defaultPlanVersion.id,
            status: "TRIALING",
            trialEndsAt: newTrialEndsAt,
            currentPeriodStart: new Date(),
            currentPeriodEnd: newTrialEndsAt,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "admin",
          action: "COMPANY_TRIAL_EXTENDED",
          resourceType: "COMPANY",
          resourceId: company.id,
          reason: String(reason),
          changes: {
            extendedDays: Number(days),
            trialEndsAt: newTrialEndsAt,
          },
        },
      });

      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("subscriptions");

      return sendSuccess(res, {
        companyId: company.id,
        extendedDays: Number(days),
        trialEndsAt: newTrialEndsAt,
        reason,
      }, undefined, `Trial period extended by ${days} days`);
    } catch (error: any) {
      return sendError(res, "Failed to extend trial period", 500);
    }
  }

  static async updateCompany(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { name, slug, ownerEmail, verificationDocuments } = req.body;

      const existing = await prisma.company.findUnique({ where: { id } });
      if (!existing) {
        return sendError(res, "Company not found", 404);
      }

      if (slug && slug !== existing.slug) {
        const slugConflict = await prisma.company.findUnique({ where: { slug } });
        if (slugConflict) {
          return sendError(res, `Company slug '${slug}' is already taken`, 409);
        }
      }

      const updated = await prisma.company.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(slug ? { slug } : {}),
          ...(ownerEmail ? { ownerEmail } : {}),
          ...(verificationDocuments !== undefined ? { verificationDocuments } : {}),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "COMPANY_METADATA_UPDATED",
          resourceType: "COMPANY",
          resourceId: existing.id,
          reason: `Updated metadata for company ${existing.name}`,
          changes: {
            previous: { name: existing.name, slug: existing.slug, ownerEmail: existing.ownerEmail },
            updated: { name: updated.name, slug: updated.slug, ownerEmail: updated.ownerEmail },
          },
        },
      });

      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Company updated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to update company", 500);
    }
  }

  static async reactivateCompany(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;

      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      const updated = await prisma.company.update({
        where: { id },
        data: {
          status: "ACTIVE",
          suspensionReason: null,
          suspendedAt: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "COMPANY_REACTIVATED",
          resourceType: "COMPANY",
          resourceId: company.id,
          reason: reason || `Reactivated tenant company ${company.name}`,
          changes: {
            previousStatus: company.status,
            newStatus: "ACTIVE",
          },
        },
      });

      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Company reactivated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to reactivate company", 500);
    }
  }

  static async rejectCompany(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason, rejectionReason } = req.body;
      const note = reason || rejectionReason || "Verification rejected by platform operator";

      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      const updated = await prisma.company.update({
        where: { id },
        data: {
          verificationStatus: "REJECTED",
          verifiedAt: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "COMPANY_VERIFICATION_REJECTED",
          resourceType: "COMPANY",
          resourceId: company.id,
          reason: note,
        },
      });

      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Company verification rejected");
    } catch (error: any) {
      return sendError(res, "Failed to reject company verification", 500);
    }
  }

  static async deleteCompany(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body || {};

      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) {
        return sendError(res, "Company not found", 404);
      }

      // Soft-delete to ARCHIVED per requirements and preservation rules
      const updated = await prisma.company.update({
        where: { id },
        data: {
          status: "ARCHIVED",
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "COMPANY_ARCHIVED",
          resourceType: "COMPANY",
          resourceId: company.id,
          reason: reason || `Archived company ${company.name}`,
        },
      });

      await invalidateCacheCategory("companies");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Company archived successfully");
    } catch (error: any) {
      return sendError(res, "Failed to delete/archive company", 500);
    }
  }
}
