import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { generateMfaSecret, generateMfaQrCode, verifyMfaToken } from "../../lib/totp";
import { AuthController } from "../auth/auth.controller";

export class ProfileController {
  /**
   * GET /api/profile
   * Return current super admin profile
   */
  static async getProfile(req: Request, res: Response) {
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
        phone: admin.phone || null,
        role: admin.role.name,
        roleSlug: admin.role.slug,
        avatarUrl: admin.avatarUrl,
        mfaEnabled: admin.mfaEnabled,
        lastLoginAt: admin.lastLoginAt,
        lastLoginIp: admin.lastLoginIp,
        createdAt: admin.createdAt,
        permissions: admin.role.permissions.map((p) => p.permissionKey),
      });
    } catch (error) {
      return sendError(res, "Failed to retrieve profile", 500);
    }
  }

  /**
   * PATCH /api/profile
   * Update profile details (name, avatar, phone)
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const { name, avatarUrl, avatar, phone } = req.body;
      const effectiveAvatar = avatarUrl !== undefined ? avatarUrl : avatar;

      if (!name && effectiveAvatar === undefined && phone === undefined) {
        return sendError(res, "At least one profile field (name, avatar, or phone) must be provided", 400);
      }

      const updated = await prisma.platformAdmin.update({
        where: { id: req.user.id },
        data: {
          ...(name ? { name: String(name).trim() } : {}),
          ...(effectiveAvatar !== undefined ? { avatarUrl: effectiveAvatar } : {}),
          ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
        },
        include: {
          role: {
            include: { permissions: true },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorEmail: req.user.email,
          actorRole: req.user.roleSlug || "admin",
          action: "PROFILE_UPDATED",
          resourceType: "PROFILE",
          resourceId: req.user.id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      return sendSuccess(res, {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone || null,
        role: updated.role.name,
        roleSlug: updated.role.slug,
        avatarUrl: updated.avatarUrl,
        mfaEnabled: updated.mfaEnabled,
        lastLoginAt: updated.lastLoginAt,
        permissions: updated.role.permissions.map((p) => p.permissionKey),
      }, undefined, "Profile updated successfully");
    } catch (error) {
      return sendError(res, "Failed to update profile", 500);
    }
  }

  /**
   * PATCH /api/profile/password
   * Change password (requires current password and new password >= 8 characters)
   */
  static async changePassword(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return sendError(res, "currentPassword and newPassword are required", 400, {
          ...(!currentPassword ? { currentPassword: ["Current password is required"] } : {}),
          ...(!newPassword ? { newPassword: ["New password is required"] } : {}),
        });
      }

      if (String(newPassword).length < 8) {
        return sendError(res, "Password must be at least 8 characters long", 400, {
          newPassword: ["Password must be at least 8 characters long"],
        });
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id: req.user.id },
      });

      if (!admin) {
        return sendError(res, "User not found", 404);
      }

      const isCurrentValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isCurrentValid) {
        return sendError(res, "Current password does not match", 400, {
          currentPassword: ["Current password is incorrect"],
        });
      }

      const hashedPassword = await bcrypt.hash(String(newPassword), 10);
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { password: hashedPassword },
      });

      // Revoke other active sessions for security
      await prisma.platformAdminSession.updateMany({
        where: {
          adminId: admin.id,
          id: req.user.sessionId ? { not: req.user.sessionId } : undefined,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          actorRole: req.user.roleSlug || "admin",
          action: "PASSWORD_CHANGED",
          resourceType: "PROFILE_SECURITY",
          resourceId: admin.id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      return sendSuccess(res, {
        message: "Password changed successfully. All other sessions have been signed out.",
      });
    } catch (error) {
      return sendError(res, "Failed to change password", 500);
    }
  }

  /**
   * POST /api/profile/2fa/setup
   * Generate secret and QR code URI for authenticator apps
   */
  static async setup2FA(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id: req.user.id },
      });

      if (!admin) {
        return sendError(res, "User not found", 404);
      }

      const secret = generateMfaSecret();
      const qrData = await generateMfaQrCode(admin.email, secret);

      // Store pending secret until enabled
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { mfaSecret: secret },
      });

      return sendSuccess(res, {
        secret: qrData.secret,
        otpauthUrl: qrData.otpauthUrl,
        qrCode: qrData.qrCodeDataUrl,
      }, undefined, "MFA setup initiated. Scan QR code or enter secret into your authenticator app.");
    } catch (error) {
      return sendError(res, "Failed to initialize 2FA setup", 500);
    }
  }

  /**
   * POST /api/profile/2fa/enable
   * Verify TOTP code and enable 2FA on the account
   */
  static async enable2FA(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const { code } = req.body;
      if (!code) {
        return sendError(res, "Verification code is required", 400, {
          code: ["TOTP code is required"],
        });
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id: req.user.id },
      });

      if (!admin || !admin.mfaSecret) {
        return sendError(res, "MFA setup has not been initiated. Please run setup first.", 400);
      }

      const isValid = verifyMfaToken(String(code), admin.mfaSecret);
      if (!isValid) {
        return sendError(res, "Invalid 2FA verification code", 400, {
          code: ["The provided 6-digit code is invalid or has expired"],
        });
      }

      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { mfaEnabled: true },
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          actorRole: req.user.roleSlug || "admin",
          action: "MFA_ENABLED",
          resourceType: "PROFILE_SECURITY",
          resourceId: admin.id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      return sendSuccess(res, {
        mfaEnabled: true,
      }, undefined, "Two-factor authentication has been successfully enabled.");
    } catch (error) {
      return sendError(res, "Failed to enable 2FA", 500);
    }
  }

  /**
   * POST /api/profile/2fa/disable
   * Disable 2FA with password confirmation
   */
  static async disable2FA(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const { password } = req.body;
      if (!password) {
        return sendError(res, "Password confirmation is required to disable 2FA", 400, {
          password: ["Password is required"],
        });
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id: req.user.id },
      });

      if (!admin) {
        return sendError(res, "User not found", 404);
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        return sendError(res, "Incorrect password", 400, {
          password: ["Password confirmation failed"],
        });
      }

      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          actorEmail: admin.email,
          actorRole: req.user.roleSlug || "admin",
          action: "MFA_DISABLED",
          resourceType: "PROFILE_SECURITY",
          resourceId: admin.id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      return sendSuccess(res, {
        mfaEnabled: false,
      }, undefined, "Two-factor authentication has been disabled.");
    } catch (error) {
      return sendError(res, "Failed to disable 2FA", 500);
    }
  }

  /**
   * GET /api/profile/api-keys
   * List API keys for the current admin (only keyPrefix is shown)
   */
  static async getApiKeys(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const keys = await prisma.platformApiKey.findMany({
        where: {
          adminId: req.user.id,
          revokedAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return sendSuccess(res, keys);
    } catch (error) {
      return sendError(res, "Failed to retrieve API keys", 500);
    }
  }

  /**
   * POST /api/profile/api-keys
   * Generate new API key; returns raw key ONCE
   */
  static async createApiKey(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const { name, scopes, expiresAt } = req.body;
      if (!name) {
        return sendError(res, "API key name is required", 400, {
          name: ["Name is required"],
        });
      }

      const randomHex = crypto.randomBytes(16).toString("hex"); // 32 hex chars
      const rawKey = `ws_live_${randomHex}`;
      const keyPrefix = `ws_live_${randomHex.slice(0, 8)}...`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

      const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;
      const validScopes = Array.isArray(scopes) ? scopes.map(String) : [];

      const created = await prisma.platformApiKey.create({
        data: {
          adminId: req.user.id,
          name: String(name).trim(),
          keyPrefix,
          keyHash,
          scopes: validScopes,
          expiresAt: parsedExpiresAt,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorEmail: req.user.email,
          actorRole: req.user.roleSlug || "admin",
          action: "API_KEY_CREATED",
          resourceType: "API_KEY",
          resourceId: created.id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      // Raw key is returned ONCE here
      return sendSuccess(
        res,
        {
          id: created.id,
          name: created.name,
          key: rawKey,
          keyPrefix: created.keyPrefix,
          scopes: created.scopes,
          expiresAt: created.expiresAt,
          createdAt: created.createdAt,
        },
        undefined,
        "API key generated successfully. Save this secret key now; it will not be shown again.",
        201
      );
    } catch (error) {
      return sendError(res, "Failed to generate API key", 500);
    }
  }

  /**
   * DELETE /api/profile/api-keys/:id
   * Revoke an API key
   */
  static async revokeApiKey(req: Request, res: Response) {
    try {
      if (!req.user) {
        return sendError(res, "Unauthorized", 401);
      }

      const id = req.params.id as string;
      const key = await prisma.platformApiKey.findFirst({
        where: { id, adminId: req.user.id },
      });

      if (!key) {
        return sendError(res, "API key not found", 404);
      }

      await prisma.platformApiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorEmail: req.user.email,
          actorRole: req.user.roleSlug || "admin",
          action: "API_KEY_REVOKED",
          resourceType: "API_KEY",
          resourceId: id,
          outcome: "SUCCESS",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      return sendSuccess(res, { id }, undefined, "API key revoked successfully");
    } catch (error) {
      return sendError(res, "Failed to revoke API key", 500);
    }
  }

  // Session routes delegate to AuthController
  static getSessions = AuthController.getSessions;
  static revokeSession = AuthController.revokeSession;
  static revokeAllOtherSessions = AuthController.revokeAllOtherSessions;
}
