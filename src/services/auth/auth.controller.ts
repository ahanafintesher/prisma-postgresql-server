import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../../lib/prisma";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { sendSuccess, sendError } from "../../lib/response";

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return sendError(res, "Email and password are required", 400);
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { email },
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      });

      if (!admin) {
        return sendError(res, "Invalid email or password", 401);
      }

      if (admin.status === "SUSPENDED") {
        return sendError(res, "Account is suspended. Contact system administrator.", 403);
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return sendError(res, "Invalid email or password", 401);
      }

      // Check if 2FA is enabled
      if (admin.mfaEnabled) {
        // Return 2FA challenge response
        return sendSuccess(res, {
          requires2FA: true,
          tempToken: generateAccessToken({
            id: admin.id,
            email: admin.email,
            role: "2FA_PENDING",
            roleSlug: "2fa-pending",
          }),
        }, undefined, "2FA verification required");
      }

      const tokenPayload = {
        id: admin.id,
        email: admin.email,
        role: admin.role.name,
        roleSlug: admin.role.slug,
      };

      const token = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken({ id: admin.id });

      // Record session in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const refreshTokenHash = await bcrypt.hash(refreshToken.slice(-10), 8);
      await prisma.platformAdminSession.create({
        data: {
          adminId: admin.id,
          refreshTokenHash,
          userAgent: req.headers["user-agent"] || null,
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          expiresAt,
        },
      });

      // Update last login
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        },
      });

      // Write audit log
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          actorRole: admin.role.slug,
          action: "ADMIN_LOGIN",
          resourceType: "AUTH",
          resourceId: admin.id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      return sendSuccess(res, {
        token,
        refreshToken,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role.name,
          roleSlug: admin.role.slug,
          permissions: admin.role.permissions.map((p) => p.permissionKey),
        },
      }, undefined, "Login successful");
    } catch (error: any) {
      console.error("Login error:", error);
      return sendError(res, "Authentication failed", 500);
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return sendError(res, "Refresh token is required", 400);
      }

      const decoded = verifyRefreshToken(refreshToken);
      const admin = await prisma.platformAdmin.findUnique({
        where: { id: decoded.id },
        include: {
          role: {
            include: { permissions: true },
          },
        },
      });

      if (!admin || admin.status === "SUSPENDED") {
        return sendError(res, "Invalid session or account suspended", 401);
      }

      const newToken = generateAccessToken({
        id: admin.id,
        email: admin.email,
        role: admin.role.name,
        roleSlug: admin.role.slug,
      });

      return sendSuccess(res, {
        token: newToken,
        refreshToken,
      }, undefined, "Token refreshed successfully");
    } catch (error) {
      return sendError(res, "Invalid or expired refresh token", 401);
    }
  }

  static async me(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id: req.user.id },
        include: {
          role: {
            include: { permissions: true },
          },
        },
      });

      if (!admin) {
        return sendError(res, "User not found", 404);
      }

      return sendSuccess(res, {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role.name,
        roleSlug: admin.role.slug,
        avatarUrl: admin.avatarUrl,
        mfaEnabled: admin.mfaEnabled,
        lastLoginAt: admin.lastLoginAt,
        permissions: admin.role.permissions.map((p) => p.permissionKey),
      });
    } catch (error: any) {
      return sendError(res, "Failed to fetch profile", 500);
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      if (req.user) {
        // Revoke active sessions
        await prisma.platformAdminSession.updateMany({
          where: {
            adminId: req.user.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }
      return sendSuccess(res, { message: "Logged out successfully" });
    } catch (error: any) {
      return sendError(res, "Logout failed", 500);
    }
  }
}
