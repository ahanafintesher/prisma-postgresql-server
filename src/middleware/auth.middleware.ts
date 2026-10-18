import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { sendError } from "../lib/response";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        roleSlug?: string;
        sessionId?: string;
        permissions?: string[];
      };
    }
  }
}

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  roleSlug?: string;
  sessionId?: string;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, "Authorization Bearer token is required", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return sendError(res, "Bearer token is required", 401);
    }

    const secret = process.env.JWT_SECRET || "default_fallback_secret_worksphere_2026";
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // If token has an associated session, verify session is not revoked or expired
    if (decoded.sessionId) {
      const session = await prisma.platformAdminSession.findUnique({
        where: { id: decoded.sessionId },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return sendError(res, "Session has expired or been revoked", 401);
      }
    }

    // Verify admin is active in database
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: decoded.id },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin || admin.status === "SUSPENDED") {
      return sendError(res, "Account is inactive or suspended", 403);
    }

    req.user = {
      id: admin.id,
      email: admin.email,
      role: admin.role.name,
      roleSlug: admin.role.slug,
      sessionId: decoded.sessionId,
      permissions: admin.role.permissions.map((p) => p.permissionKey),
    };

    next();
  } catch (error) {
    return sendError(res, "Invalid or expired token", 401);
  }
};

export const requirePermission = (permissionKey: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    // Root super admin bypasses individual permission checks
    if (req.user.roleSlug === "super-admin-root") {
      return next();
    }

    if (
      !req.user.permissions ||
      !req.user.permissions.includes(permissionKey)
    ) {
      return sendError(
        res,
        `Access denied: Missing '${permissionKey}' permission`,
        403
      );
    }

    next();
  };
};