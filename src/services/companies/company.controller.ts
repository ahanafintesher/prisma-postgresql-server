import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";

export class CompanyController {
  static async getCompanies(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const skip = (page - 1) * limit;

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
          take: limit,
          orderBy: { createdAt: "desc" },
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

      return sendSuccess(res, formattedCompanies, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
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

      return sendSuccess(res, updated, undefined, `Company verification status set to ${verificationStatus}`);
    } catch (error: any) {
      return sendError(res, "Failed to process verification", 500);
    }
  }
}
