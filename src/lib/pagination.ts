import { Request, Response } from "express";
import { PaginationMeta, sendSuccess } from "./response";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
  sortBy?: string;
  sortOrder: "asc" | "desc";
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultSortBy?: string;
  defaultSortOrder?: "asc" | "desc";
  allowedSortFields?: string[];
}

/**
 * Parses and validates pagination and sorting parameters from an Express Request.
 * Supports standard aliases (e.g. limit / pageSize / per_page / size, page / p, sortBy / sort / orderBy).
 */
export function parsePaginationParams(
  req: Request,
  options: PaginationOptions = {}
): PaginationParams {
  const {
    defaultLimit = 10,
    maxLimit = 100,
    defaultSortBy = "createdAt",
    defaultSortOrder = "desc",
    allowedSortFields,
  } = options;

  // 1. Parse page number (1-indexed, minimum 1)
  const rawPage = req.query.page || req.query.p;
  const parsedPage = parseInt(rawPage as string, 10);
  const page = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  // 2. Parse limit / page size (minimum 1, capped at maxLimit)
  const rawLimit =
    req.query.limit ||
    req.query.pageSize ||
    req.query.per_page ||
    req.query.size;
  const parsedLimit = parseInt(rawLimit as string, 10);
  const limit =
    !isNaN(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, maxLimit)
      : defaultLimit;

  // 3. Calculate database offset
  const skip = (page - 1) * limit;
  const take = limit;

  // 4. Parse sorting field
  const rawSortBy = (req.query.sortBy || req.query.sort || req.query.orderBy) as string | undefined;
  let sortBy = defaultSortBy;
  if (rawSortBy) {
    const trimmed = rawSortBy.trim();
    if (!allowedSortFields || allowedSortFields.includes(trimmed)) {
      sortBy = trimmed;
    }
  }

  // 5. Parse sort order ("asc" or "desc")
  const rawOrder = (req.query.sortOrder || req.query.order || req.query.dir) as string | undefined;
  const sortOrder: "asc" | "desc" =
    rawOrder && rawOrder.toLowerCase() === "asc" ? "asc" : defaultSortOrder;

  return {
    page,
    limit,
    skip,
    take,
    sortBy,
    sortOrder,
  };
}

/**
 * Builds rich, standardized pagination metadata with navigation flags.
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
  };
}

/**
 * Sends a standard paginated response envelope.
 */
export function sendPaginated<T = any>(
  res: Response,
  data: T,
  total: number,
  page: number,
  limit: number,
  message?: string,
  statusCode = 200
) {
  const pagination = createPaginationMeta(total, page, limit);
  return sendSuccess(res, data, pagination, message, statusCode);
}
