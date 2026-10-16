import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";

export class PaymentController {
  static async getPayments(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const skip = (page - 1) * limit;

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

      return sendSuccess(res, formatted, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
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

      return sendSuccess(res, payment);
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

      return sendSuccess(res, updated, undefined, "Refund processed successfully");
    } catch (error: any) {
      return sendError(res, "Failed to process refund", 500);
    }
  }
}
