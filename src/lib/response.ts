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

export type ErrorDetails = Record<string, string[]>;

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, any> | string[] | string | any
) {
  let formattedErrors: ErrorDetails | undefined = undefined;

  if (errors) {
    if (typeof errors === "object" && !Array.isArray(errors)) {
      formattedErrors = {};
      for (const [key, val] of Object.entries(errors)) {
        if (Array.isArray(val)) {
          formattedErrors[key] = val.map((v) => String(v));
        } else if (typeof val === "string") {
          formattedErrors[key] = [val];
        } else if (val !== null && val !== undefined) {
          formattedErrors[key] = [String(val)];
        }
      }
    } else if (Array.isArray(errors)) {
      formattedErrors = {
        _general: errors.map((e) => (typeof e === "string" ? e : JSON.stringify(e))),
      };
    } else if (typeof errors === "string") {
      formattedErrors = {
        _general: [errors],
      };
    }
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(formattedErrors && Object.keys(formattedErrors).length > 0
      ? { errors: formattedErrors }
      : {}),
  });
}
