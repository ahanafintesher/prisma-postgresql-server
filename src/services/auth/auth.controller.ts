import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../../lib/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken,
  hashToken,
  RefreshTokenPayload,
} from "../../lib/jwt";
import { sendSuccess, sendError } from "../../lib/response";
import { verifyMfaToken } from "../../lib/totp";

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

      // Record session in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const session = await prisma.platformAdminSession.create({
        data: {
          adminId: admin.id,
          refreshTokenHash: "pending",
          userAgent: (req.headers["user-agent"] as string) || null,
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          expiresAt,
        },
      });

      const tokenPayload = {
        id: admin.id,
        email: admin.email,
        role: admin.role.name,
        roleSlug: admin.role.slug,
        sessionId: session.id,
      };

      const token = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken({ id: admin.id, sessionId: session.id });

      await prisma.platformAdminSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: hashToken(refreshToken),
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
        accessToken: token,
        refreshToken,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role.name,
          roleSlug: admin.role.slug,
          mfaEnabled: admin.mfaEnabled,
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
      const refreshToken = req.body?.refreshToken || (req.headers["x-refresh-token"] as string);
      if (!refreshToken) {
        return sendError(res, "Refresh token is required", 400);
      }

      let decoded: RefreshTokenPayload;
      try {
        decoded = verifyRefreshToken(refreshToken);
      } catch (err) {
        return sendError(res, "Invalid or expired refresh token", 401);
      }

      if (!decoded.sessionId || !decoded.id) {
        return sendError(res, "Malformed refresh token session reference", 401);
      }

      const session = await prisma.platformAdminSession.findUnique({
        where: { id: decoded.sessionId },
        include: {
          admin: {
            include: {
              role: {
                include: { permissions: true },
              },
            },
          },
        },
      });

      if (!session || session.adminId !== decoded.id) {
        return sendError(res, "Invalid session reference", 401);
      }

      if (session.revokedAt || session.expiresAt < new Date()) {
        return sendError(res, "Session has expired or been revoked", 401);
      }

      const expectedHash = hashToken(refreshToken);
      if (session.refreshTokenHash !== expectedHash) {
        // Potential token reuse / compromise detected: immediately revoke session
        await prisma.platformAdminSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return sendError(res, "Invalid refresh token. Session has been revoked for security.", 401);
      }

      const admin = session.admin;
      if (!admin || admin.status === "SUSPENDED") {
        return sendError(res, "Account is invalid or suspended", 403);
      }

      // Rotate refresh token and update session
      const newRefreshToken = generateRefreshToken({ id: admin.id, sessionId: session.id });
      const newToken = generateAccessToken({
        id: admin.id,
        email: admin.email,
        role: admin.role.name,
        roleSlug: admin.role.slug,
        sessionId: session.id,
      });

      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      await prisma.platformAdminSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: hashToken(newRefreshToken),
          expiresAt: newExpiresAt,
        },
      });

      return sendSuccess(
        res,
        {
          token: newToken,
          accessToken: newToken,
          refreshToken: newRefreshToken,
        },
        undefined,
        "Token refreshed successfully"
      );
    } catch (error) {
      return sendError(res, "Failed to refresh token", 500);
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
        if (req.user.sessionId) {
          // Revoke current session only
          await prisma.platformAdminSession.update({
            where: { id: req.user.sessionId },
            data: { revokedAt: new Date() },
          });
        } else {
          // Fallback: revoke all sessions if token has no sessionId
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
      }
      return sendSuccess(res, { message: "Logged out successfully" });
    } catch (error: any) {
      return sendError(res, "Logout failed", 500);
    }
  }

  static async verify2FA(req: Request, res: Response) {
    try {
      const { tempToken, code } = req.body;

      if (!tempToken || !code) {
        return sendError(res, "tempToken and 6-digit 2FA code are required", 400);
      }

      let decoded: any;
      try {
        decoded = verifyAccessToken(tempToken);
      } catch (err) {
        return sendError(res, "Invalid or expired 2FA session token", 401);
      }

      if (decoded.role !== "2FA_PENDING") {
        return sendError(res, "Invalid token type for 2FA verification", 401);
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id: decoded.id },
        include: {
          role: {
            include: { permissions: true },
          },
        },
      });

      if (!admin || admin.status === "SUSPENDED") {
        return sendError(res, "Account is invalid or suspended", 403);
      }

      if (!admin.mfaSecret) {
        return sendError(res, "Two-factor authentication is not configured for this account", 400);
      }

      // Valid TOTP format check (standard 6-digit numeric token)
      const sanitizedCode = String(code).trim();
      if (!/^\d{6}$/.test(sanitizedCode)) {
        return sendError(res, "Invalid 2FA code format. Must be 6 digits.", 400, {
          code: ["Must be a 6-digit numeric code"],
        });
      }

      const isTotpValid = verifyMfaToken(sanitizedCode, admin.mfaSecret);
      if (!isTotpValid) {
        return sendError(res, "Invalid or expired 2FA verification code", 401, {
          code: ["The provided 6-digit code is incorrect or expired"],
        });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const session = await prisma.platformAdminSession.create({
        data: {
          adminId: admin.id,
          refreshTokenHash: "pending",
          userAgent: (req.headers["user-agent"] as string) || null,
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          expiresAt,
        },
      });

      const tokenPayload = {
        id: admin.id,
        email: admin.email,
        role: admin.role.name,
        roleSlug: admin.role.slug,
        sessionId: session.id,
      };

      const token = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken({ id: admin.id, sessionId: session.id });

      await prisma.platformAdminSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: hashToken(refreshToken),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          actorRole: admin.role.slug,
          action: "ADMIN_LOGIN_2FA_SUCCESS",
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
          mfaEnabled: admin.mfaEnabled,
          permissions: admin.role.permissions.map((p) => p.permissionKey),
        },
      }, undefined, "2FA authentication successful");
    } catch (error: any) {
      console.error("2FA error:", error);
      return sendError(res, "Failed to complete 2FA verification", 500);
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return sendError(res, "Email address is required", 400);
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { email },
      });

      // Always return a generic success message to prevent user enumeration
      if (!admin || admin.status === "SUSPENDED") {
        return sendSuccess(res, {
          message: "If an active account exists with that email, a password reset link has been dispatched.",
        });
      }

      // Generate a secure reset token valid for 1 hour
      const resetToken = generateAccessToken({
        id: admin.id,
        email: admin.email,
        role: "PASSWORD_RESET",
        roleSlug: "password-reset",
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          actorRole: "system",
          action: "PASSWORD_RESET_REQUESTED",
          resourceType: "AUTH",
          resourceId: admin.id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        },
      });

      return sendSuccess(res, {
        message: "If an active account exists with that email, a password reset link has been dispatched.",
        // Include resetToken in dev/staging mode for integration testing
        ...(process.env.NODE_ENV !== "production" ? { resetToken } : {}),
      });
    } catch (error) {
      return sendError(res, "Failed to process password reset request", 500);
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return sendError(res, "Reset token and newPassword are required", 400);
      }

      if (newPassword.length < 8) {
        return sendError(res, "Password must be at least 8 characters long", 400);
      }

      let decoded: any;
      try {
        decoded = verifyAccessToken(token);
        if (decoded.role !== "PASSWORD_RESET") {
          return sendError(res, "Invalid token type for password reset", 400);
        }
      } catch (err) {
        return sendError(res, "Invalid or expired reset token", 401);
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      await prisma.platformAdmin.update({
        where: { id: decoded.id },
        data: { password: newPasswordHash },
      });

      // Revoke all existing sessions
      await prisma.platformAdminSession.updateMany({
        where: { adminId: decoded.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          actorId: decoded.id,
          actorEmail: decoded.email,
          actorRole: "system",
          action: "PASSWORD_RESET_COMPLETED",
          resourceType: "AUTH",
          resourceId: decoded.id,
          outcome: "SUCCESS",
        },
      });

      return sendSuccess(res, {
        message: "Password has been reset successfully. Please log in with your new credentials.",
      });
    } catch (error) {
      return sendError(res, "Failed to reset password", 500);
    }
  }

  static async getSessions(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const sessions = await prisma.platformAdminSession.findMany({
        where: {
          adminId: req.user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
        },
      });

      return sendSuccess(res, sessions);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve active sessions", 500);
    }
  }

  static async revokeSession(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const id = req.params.id as string;
      const session = await prisma.platformAdminSession.findFirst({
        where: { id, adminId: req.user.id },
      });

      if (!session) {
        return sendError(res, "Session not found", 404);
      }

      await prisma.platformAdminSession.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorEmail: req.user.email,
          actorRole: req.user.roleSlug || "system",
          action: "ADMIN_SESSION_REVOKED",
          resourceType: "AUTH_SESSION",
          resourceId: id,
          outcome: "SUCCESS",
        },
      });

      return sendSuccess(res, { id }, undefined, "Session revoked successfully");
    } catch (error: any) {
      return sendError(res, "Failed to revoke session", 500);
    }
  }

  static async revokeAllOtherSessions(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      await prisma.platformAdminSession.updateMany({
        where: {
          adminId: req.user.id,
          id: req.user.sessionId ? { not: req.user.sessionId } : undefined,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorEmail: req.user.email,
          actorRole: req.user.roleSlug || "system",
          action: "ALL_OTHER_SESSIONS_REVOKED",
          resourceType: "AUTH_SESSION",
          outcome: "SUCCESS",
        },
      });

      return sendSuccess(res, { message: "All other sessions have been revoked." });
    } catch (error: any) {
      return sendError(res, "Failed to revoke sessions", 500);
    }
  }
}

