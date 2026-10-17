import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendSuccess, sendError } from "../../lib/response";
import { invalidateCacheCategory } from "../../lib/redis";
import { parsePaginationParams, sendPaginated } from "../../lib/pagination";

export class RolesController {
  static async getRoles(req: Request, res: Response) {
    try {
      const isPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.pageSize !== undefined;
      const { page, limit, skip, take, sortBy, sortOrder } = parsePaginationParams(req, {
        defaultLimit: 20,
        maxLimit: 100,
        defaultSortBy: "createdAt",
        defaultSortOrder: "asc",
        allowedSortFields: ["createdAt", "name", "slug"],
      });

      const includeClause = {
        permissions: {
          select: {
            permissionKey: true,
          },
        },
        _count: {
          select: {
            admins: true,
          },
        },
      };

      if (isPaginated) {
        const [total, roles] = await Promise.all([
          prisma.platformRole.count(),
          prisma.platformRole.findMany({
            skip,
            take,
            orderBy: { [sortBy || "createdAt"]: sortOrder },
            include: includeClause,
          }),
        ]);

        const formatted = roles.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          isSystem: r.isSystem,
          adminCount: r._count.admins,
          permissions: r.permissions.map((p) => p.permissionKey),
          createdAt: r.createdAt,
        }));

        return sendPaginated(res, formatted, total, page, limit);
      }

      const roles = await prisma.platformRole.findMany({
        orderBy: { createdAt: "asc" },
        include: includeClause,
      });

      const formatted = roles.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        isSystem: r.isSystem,
        adminCount: r._count.admins,
        permissions: r.permissions.map((p) => p.permissionKey),
        createdAt: r.createdAt,
      }));

      return sendSuccess(res, formatted);
    } catch (error: any) {
      console.error("Get roles error:", error);
      return sendError(res, "Failed to retrieve roles", 500);
    }
  }

  static async getRoleById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const role = await prisma.platformRole.findUnique({
        where: { id },
        include: {
          permissions: {
            include: { permission: true },
          },
          _count: {
            select: { admins: true },
          },
        },
      });

      if (!role) {
        return sendError(res, "Role not found", 404);
      }

      return sendSuccess(res, {
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        isSystem: role.isSystem,
        adminCount: role._count.admins,
        permissions: role.permissions.map((p) => p.permissionKey),
        permissionDetails: role.permissions.map((p) => p.permission),
        createdAt: role.createdAt,
      });
    } catch (error: any) {
      return sendError(res, "Failed to retrieve role details", 500);
    }
  }

  static async createRole(req: Request, res: Response) {
    try {
      const { name, slug, description, permissions = [] } = req.body;

      if (!name || !slug) {
        return sendError(res, "Role name and slug are required", 400);
      }

      const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-");
      const existing = await prisma.platformRole.findUnique({ where: { slug: cleanSlug } });
      if (existing) {
        return sendError(res, `Role slug '${cleanSlug}' already exists`, 409);
      }

      const role = await prisma.platformRole.create({
        data: {
          name,
          slug: cleanSlug,
          description: description || null,
          isSystem: false,
          permissions: {
            create: (Array.isArray(permissions) ? permissions : []).map((key: string) => ({
              permissionKey: key,
            })),
          },
        },
        include: {
          permissions: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "ROLE_CREATED",
          resourceType: "ROLE",
          resourceId: role.id,
          reason: `Created custom platform role '${role.name}'`,
        },
      });

      await invalidateCacheCategory("roles");

      return sendSuccess(res, role, undefined, "Role created successfully", 201);
    } catch (error: any) {
      console.error("Create role error:", error);
      return sendError(res, "Failed to create role", 500);
    }
  }

  static async updateRole(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { name, description, permissions } = req.body;

      const existing = await prisma.platformRole.findUnique({ where: { id } });
      if (!existing) {
        return sendError(res, "Role not found", 404);
      }

      // If system role, cannot change slug
      const updated = await prisma.platformRole.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });

      // Update permissions if provided
      if (Array.isArray(permissions)) {
        await prisma.platformRolePermission.deleteMany({ where: { roleId: id } });
        if (permissions.length > 0) {
          await prisma.platformRolePermission.createMany({
            data: permissions.map((key: string) => ({
              roleId: id,
              permissionKey: key,
            })),
          });
        }
      }

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "ROLE_UPDATED",
          resourceType: "ROLE",
          resourceId: id,
          reason: `Updated permissions/metadata for role '${existing.name}'`,
        },
      });

      await invalidateCacheCategory("roles");

      return sendSuccess(res, updated, undefined, "Role updated successfully");
    } catch (error: any) {
      console.error("Update role error:", error);
      return sendError(res, "Failed to update role", 500);
    }
  }

  static async deleteRole(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const existing = await prisma.platformRole.findUnique({
        where: { id },
        include: { _count: { select: { admins: true } } },
      });

      if (!existing) {
        return sendError(res, "Role not found", 404);
      }

      if (existing.isSystem) {
        return sendError(res, "System roles cannot be deleted", 400);
      }

      if (existing._count.admins > 0) {
        return sendError(res, `Cannot delete role with ${existing._count.admins} assigned admin(s)`, 400);
      }

      await prisma.platformRole.delete({ where: { id } });

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id || null,
          actorEmail: req.user?.email || "system",
          actorRole: req.user?.roleSlug || "system",
          action: "ROLE_DELETED",
          resourceType: "ROLE",
          resourceId: id,
          reason: `Deleted role '${existing.name}'`,
        },
      });

      await invalidateCacheCategory("roles");

      return sendSuccess(res, { id }, undefined, "Role deleted successfully");
    } catch (error: any) {
      return sendError(res, "Failed to delete role", 500);
    }
  }

  static async getPermissions(req: Request, res: Response) {
    try {
      const permissions = await prisma.platformPermission.findMany({
        orderBy: [{ category: "asc" }, { key: "asc" }],
      });

      // Group by category for easier UI rendering
      const grouped: Record<string, typeof permissions> = {};
      for (const p of permissions) {
        if (!grouped[p.category]) {
          grouped[p.category] = [];
        }
        grouped[p.category].push(p);
      }

      return sendSuccess(res, {
        all: permissions,
        byCategory: grouped,
      });
    } catch (error: any) {
      return sendError(res, "Failed to retrieve permissions list", 500);
    }
  }
}
