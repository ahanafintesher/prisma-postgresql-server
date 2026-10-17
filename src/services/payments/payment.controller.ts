import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { invalidateCacheCategory } from "../../lib/redis";
import { parsePaginationParams, sendPaginated } from "../../lib/pagination";

export class PaymentController {
  static async getPayments(req: Request, res: Response) {
    try {
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "amount", "status", "gateway", "currency"],
      });

      const search = (req.query.search as string)?.trim() || "";
      const status = req.query.status as any;
      const gateway = req.query.gateway as any;

      const whereClause: any = {};

      if (status && status !== "ALL") {
        whereClause.status = status;
      }

      if (gateway && gateway !== "ALL") {
        whereClause.gateway = gateway;
      }

      if (search) {
        whereClause.OR = [
          { transactionRef: { contains: search, mode: "insensitive" } },
          { idempotencyKey: { contains: search, mode: "insensitive" } },
          { company: { name: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [total, payments] = await Promise.all([
        prisma.payment.count({ where: whereClause }),
        prisma.payment.findMany({
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
          },
        }),
      ]);

      const formatted = payments.map((p) => ({
        id: p.id,
        companyName: p.company.name,
        companySlug: p.company.slug,
        companyId: p.companyId,
        gateway: p.gateway,
        amount: Math.round(p.amount / 100),
        amountCents: p.amount,
        currency: p.currency,
        status: p.status,
        transactionRef: p.transactionRef,
        idempotencyKey: p.idempotencyKey,
        refundedAmount: Math.round(p.refundedAmount / 100),
        refundReason: p.refundReason,
        createdAt: p.createdAt,
      }));

      return sendPaginated(res, formatted, total, page, limit);
    } catch (error: any) {
      console.error("Get payments error:", error);
      return sendError(res, "Failed to retrieve payments", 500);
    }
  }

  static async getPaymentById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          company: true,
          subscription: {
            include: {
              planVersion: { include: { plan: true } },
            },
          },
        },
      });

      if (!payment) {
        return sendError(res, "Payment not found", 404);
      }

      const formatted = {
        ...payment,
        amount: Math.round(payment.amount / 100),
        amountCents: payment.amount,
        refundedAmount: Math.round(payment.refundedAmount / 100),
        refundedAmountCents: payment.refundedAmount,
      };

      return sendSuccess(res, formatted);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve payment details", 500);
    }
  }

  static async issueRefund(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason, refundAmount } = req.body;

      if (!reason) {
        return sendError(res, "Reason is mandatory for processing a refund", 400);
      }

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { company: true },
      });

      if (!payment) {
        return sendError(res, "Payment record not found", 404);
      }

      if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") {
        return sendError(res, `Cannot refund a payment with status '${payment.status}'`, 400);
      }

      const availableToRefund = payment.amount - payment.refundedAmount;
      const amountToRefund = refundAmount ? Math.min(refundAmount * 100, availableToRefund) : availableToRefund;

      if (amountToRefund <= 0) {
        return sendError(res, "No remaining balance available to refund", 400);
      }

      const isFullRefund = payment.refundedAmount + amountToRefund >= payment.amount;
      const newStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: newStatus,
          refundReason: reason,
          refundedAmount: payment.refundedAmount + amountToRefund,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "PAYMENT_REFUNDED",
          resourceType: "PAYMENT",
          resourceId: payment.id,
          reason,
          changes: {
            refundAmountCents: amountToRefund,
            previousStatus: payment.status,
            newStatus,
          },
        },
      });

      // Invalidate payments and dashboard caches
      await invalidateCacheCategory("payments");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Refund processed successfully");
    } catch (error: any) {
      return sendError(res, "Failed to process refund", 500);
    }
  }

  static async reconcilePayment(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body || {};

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { company: true },
      });

      if (!payment) {
        return sendError(res, "Payment not found", 404);
      }

      // Reconcile status to SUCCEEDED or specified valid status
      const targetStatus = status || (payment.status === "PENDING" ? "SUCCEEDED" : payment.status);
      const isSucceeded = targetStatus === "SUCCEEDED";

      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: targetStatus,
          capturedAt: isSucceeded ? (payment.capturedAt || new Date()) : payment.capturedAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "PAYMENT_RECONCILED",
          resourceType: "PAYMENT",
          resourceId: payment.id,
          reason: `Reconciled gateway state for payment ${payment.id} from ${payment.status} to ${targetStatus}`,
          changes: {
            previousStatus: payment.status,
            reconciledStatus: targetStatus,
          },
        },
      });

      await invalidateCacheCategory("payments");
      await invalidateCacheCategory("dashboard");

      return sendSuccess(res, updated, undefined, "Payment reconciled successfully");
    } catch (error: any) {
      console.error("Reconcile payment error:", error);
      return sendError(res, "Failed to reconcile payment", 500);
    }
  }

  static async getPromotions(req: Request, res: Response) {
    try {
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "code", "discountValue", "discountType", "validUntil"],
      });

      const search = (req.query.search as string)?.trim() || "";
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;

      const whereClause: any = {};
      if (isActive !== undefined) {
        whereClause.isActive = isActive;
      }
      if (search) {
        whereClause.OR = [
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, promotions] = await Promise.all([
        prisma.promotion.count({ where: whereClause }),
        prisma.promotion.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { [sortBy || "createdAt"]: sortOrder },
        }),
      ]);

      return sendPaginated(res, promotions, total, page, limit);
    } catch (error: any) {
      console.error("Get promotions error:", error);
      return sendError(res, "Failed to retrieve promotions", 500);
    }
  }

  static async createPromotion(req: Request, res: Response) {
    try {
      const {
        code,
        description,
        discountType = "PERCENTAGE",
        discountValue,
        validUntil,
        maxRedemptions,
      } = req.body;

      if (!code || discountValue === undefined) {
        return sendError(res, "Promotion code and discountValue are required", 400);
      }

      const existing = await prisma.promotion.findUnique({
        where: { code: code.toUpperCase().trim() },
      });
      if (existing) {
        return sendError(res, `Promotion code '${code}' already exists`, 409);
      }

      const promotion = await prisma.promotion.create({
        data: {
          code: code.toUpperCase().trim(),
          description: description || null,
          discountType,
          discountValue: parseInt(discountValue),
          validUntil: validUntil ? new Date(validUntil) : null,
          maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : null,
          isActive: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "PROMOTION_CREATED",
          resourceType: "PROMOTION",
          resourceId: promotion.id,
          reason: `Created promotion coupon ${promotion.code}`,
        },
      });

      await invalidateCacheCategory("promotions");

      return sendSuccess(res, promotion, undefined, "Promotion created successfully", 201);
    } catch (error: any) {
      console.error("Create promotion error:", error);
      return sendError(res, "Failed to create promotion", 500);
    }
  }

  static async updatePromotion(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const {
        description,
        discountType,
        discountValue,
        validUntil,
        maxRedemptions,
        isActive,
      } = req.body;

      const existing = await prisma.promotion.findUnique({ where: { id } });
      if (!existing) {
        return sendError(res, "Promotion not found", 404);
      }

      const updated = await prisma.promotion.update({
        where: { id },
        data: {
          ...(description !== undefined ? { description } : {}),
          ...(discountType !== undefined ? { discountType } : {}),
          ...(discountValue !== undefined ? { discountValue: parseInt(discountValue) } : {}),
          ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
          ...(maxRedemptions !== undefined ? { maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : null } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        },
      });

      await invalidateCacheCategory("promotions");

      return sendSuccess(res, updated, undefined, "Promotion updated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to update promotion", 500);
    }
  }

  static async deletePromotion(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const existing = await prisma.promotion.findUnique({ where: { id } });
      if (!existing) {
        return sendError(res, "Promotion not found", 404);
      }

      await prisma.promotion.delete({ where: { id } });

      await invalidateCacheCategory("promotions");

      return sendSuccess(res, { id }, undefined, "Promotion deleted successfully");
    } catch (error: any) {
      return sendError(res, "Failed to delete promotion", 500);
    }
  }
}
