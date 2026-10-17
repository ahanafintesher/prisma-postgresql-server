import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { invalidateCacheCategory } from "../../lib/redis";
import { parsePaginationParams, sendPaginated } from "../../lib/pagination";

export class AdminUsersController {
  static async getAdminUsers(req: Request, res: Response) {
    try {
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 10,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        allowedSortFields: ["createdAt", "name", "email", "status", "lastLoginAt"],
      });

      const search = (req.query.search as string)?.trim() || "";
      const status = req.query.status as any;
      const roleId = req.query.roleId as string;

      const whereClause: any = {};
      if (status && status !== "ALL") {
        whereClause.status = status;
      }
      if (roleId && roleId !== "ALL") {
        whereClause.roleId = roleId;
      }
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, admins] = await Promise.all([
        prisma.platformAdmin.count({ where: whereClause }),
        prisma.platformAdmin.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { [sortBy || "createdAt"]: sortOrder },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            avatarUrl: true,
            roleId: true,
            mfaEnabled: true,
            lastLoginAt: true,
            lastLoginIp: true,
            createdAt: true,
            role: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
      ]);

      return sendPaginated(res, admins, total, page, limit);
    } catch (error: any) {
      console.error("Get admin users error:", error);
      return sendError(res, "Failed to retrieve admin users", 500);
    }
  }

  static async getAdminUserById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const admin = await prisma.platformAdmin.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          avatarUrl: true,
          roleId: true,
          mfaEnabled: true,
          lastLoginAt: true,
          lastLoginIp: true,
          createdAt: true,
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (!admin) {
        return sendError(res, "Admin user not found", 404);
      }

      return sendSuccess(res, admin);
    } catch (error: any) {
      return sendError(res, "Failed to retrieve admin user details", 500);
    }
  }

  static async createAdminUser(req: Request, res: Response) {
    try {
      const { name, email, password, roleId } = req.body;

      if (!name || !email || !password || !roleId) {
        return sendError(res, "Name, email, password, and roleId are required", 400);
      }

      const existing = await prisma.platformAdmin.findUnique({
        where: { email: email.toLowerCase().trim() },
      });
      if (existing) {
        return sendError(res, `Admin with email '${email}' already exists`, 409);
      }

      const role = await prisma.platformRole.findUnique({ where: { id: roleId } });
      if (!role) {
        return sendError(res, "Specified platform role not found", 404);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = await prisma.platformAdmin.create({
        data: {
          name,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          roleId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          roleId: true,
          role: { select: { id: true, name: true, slug: true } },
          createdAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "ADMIN_USER_CREATED",
          resourceType: "ADMIN_USER",
          resourceId: newAdmin.id,
          reason: `Invited/created platform admin ${newAdmin.email} with role ${role.name}`,
        },
      });

      await invalidateCacheCategory("admin_users");

      return sendSuccess(res, newAdmin, undefined, "Admin user created successfully", 201);
    } catch (error: any) {
      console.error("Create admin user error:", error);
      return sendError(res, "Failed to create admin user", 500);
    }
  }

  static async updateAdminUser(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { name, email, roleId, password } = req.body;

      const existing = await prisma.platformAdmin.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!existing) {
        return sendError(res, "Admin user not found", 404);
      }

      if (email && email.toLowerCase() !== existing.email.toLowerCase()) {
        const emailConflict = await prisma.platformAdmin.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (emailConflict) {
          return sendError(res, `Email '${email}' is already in use`, 409);
        }
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email.toLowerCase().trim();
      if (roleId) {
        const role = await prisma.platformRole.findUnique({ where: { id: roleId } });
        if (!role) {
          return sendError(res, "Specified platform role not found", 404);
        }
        updateData.roleId = roleId;
      }
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updated = await prisma.platformAdmin.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          roleId: true,
          role: { select: { id: true, name: true, slug: true } },
          updatedAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "ADMIN_USER_UPDATED",
          resourceType: "ADMIN_USER",
          resourceId: existing.id,
          reason: `Updated admin profile for ${existing.email}`,
        },
      });

      await invalidateCacheCategory("admin_users");

      return sendSuccess(res, updated, undefined, "Admin user updated successfully");
    } catch (error: any) {
      return sendError(res, "Failed to update admin user", 500);
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status || !["ACTIVE", "SUSPENDED", "PENDING"].includes(status)) {
        return sendError(res, "Valid status ('ACTIVE', 'SUSPENDED', 'PENDING') is required", 400);
      }

      const admin = await prisma.platformAdmin.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!admin) {
        return sendError(res, "Admin user not found", 404);
      }

      if (admin.role.slug === "super-admin-root" && status !== "ACTIVE") {
        return sendError(res, "Cannot suspend or deactivate the root Super Admin account", 400);
      }

      if (req.user?.id === admin.id && status !== "ACTIVE") {
        return sendError(res, "Cannot alter your own active status", 400);
      }

      const updated = await prisma.platformAdmin.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          role: { select: { id: true, name: true, slug: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: `ADMIN_STATUS_${status}`,
          resourceType: "ADMIN_USER",
          resourceId: admin.id,
          reason: `Updated admin ${admin.email} status to ${status}`,
        },
      });

      await invalidateCacheCategory("admin_users");

      return sendSuccess(res, updated, undefined, `Admin status updated to ${status}`);
    } catch (error: any) {
      return sendError(res, "Failed to update admin status", 500);
    }
  }

  static async deleteAdminUser(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const admin = await prisma.platformAdmin.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!admin) {
        return sendError(res, "Admin user not found", 404);
      }

      if (admin.role.slug === "super-admin-root") {
        return sendError(res, "Root Super Admin account cannot be deleted", 400);
      }

      if (req.user?.id === admin.id) {
        return sendError(res, "Cannot delete your own admin account", 400);
      }

      await prisma.platformAdminSession.deleteMany({ where: { adminId: id } });
      await prisma.platformAdmin.delete({ where: { id } });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "ADMIN_USER_DELETED",
          resourceType: "ADMIN_USER",
          resourceId: id,
          reason: `Deleted platform admin ${admin.email}`,
        },
      });

      await invalidateCacheCategory("admin_users");

      return sendSuccess(res, { id }, undefined, "Admin user deleted successfully");
    } catch (error: any) {
      return sendError(res, "Failed to delete admin user", 500);
    }
  }
}
