import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  nextPage?: number | null;
  prevPage?: number | null;
}

export function sendSuccess<T = any>(
  res: Response,
  data: T,
  pagination?: PaginationMeta,
  message?: string,
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(pagination
      ? {
          pagination,
          meta: pagination,
        }
      : {}),
    ...(message ? { message } : {}),
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: any
) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}
