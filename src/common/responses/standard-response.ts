import type { Request, Response } from 'express';
import { SYS_MSG } from '../constants/sys-msg';

export interface PaginationMeta {
  total?: number;
  page?: number;
  limit?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  nextCursor?: string | null;
  prevCursor?: string | null;
}

export interface ResponseMeta {
  timestamp: string;
  version?: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

export interface APIResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta: ResponseMeta;
}

export interface APIErrorResponse {
  success: false;
  message: string[] | string;
  error?: string;
  statusCode?: number;
  meta: ResponseMeta;
}

type SuccessPayload<T> = T | { payload: T; paginationMeta: PaginationMeta };

type SuccessOptions = {
  request?: Request;
  statusCode?: number;
  method?: string;
  message?: string;
  meta?: Partial<ResponseMeta>;
};

type ErrorOptions = {
  request?: Request;
  statusCode?: number;
  error?: string;
  meta?: Partial<ResponseMeta>;
};

export class StandardResponse {
  private static appVersion: string | undefined;

  static setVersion(version: string | undefined): void {
    this.appVersion = version?.trim() || undefined;
  }

  static success<T>(
    data?: SuccessPayload<T>,
    options: SuccessOptions = {},
  ): APIResponse<T | undefined> {
    const extracted = this.extractPayload(data);

    return {
      success: true,
      message:
        options.message ??
        this.resolveSuccessMessage(options.method, options.statusCode),
      data: extracted.data,
      meta: this.buildMeta(options.request, {
        ...options.meta,
        ...(extracted.pagination ? { pagination: extracted.pagination } : {}),
      }),
    };
  }

  static error(
    message: string[] | string,
    options: ErrorOptions = {},
  ): APIErrorResponse {
    return {
      success: false,
      message,
      error: options.error,
      statusCode: options.statusCode,
      meta: this.buildMeta(options.request, options.meta),
    };
  }

  static sendSuccess<T>(
    res: Response,
    data?: SuccessPayload<T>,
    options: SuccessOptions = {},
  ): void {
    const statusCode = options.statusCode ?? 200;

    if (statusCode === 204) {
      res.status(statusCode).send();
      return;
    }

    res.status(statusCode).json(this.success(data, options));
  }

  static sendError(
    res: Response,
    message: string[] | string,
    options: ErrorOptions = {},
  ): void {
    res.status(options.statusCode ?? 500).json(this.error(message, options));
  }

  private static buildMeta(
    request?: Request,
    meta: Partial<ResponseMeta> = {},
  ): ResponseMeta {
    return {
      timestamp: new Date().toISOString(),
      version: this.appVersion,
      requestId: this.getRequestId(request),
      ...meta,
    };
  }

  private static extractPayload<T>(payload?: SuccessPayload<T>): {
    data?: T;
    pagination?: PaginationMeta;
  } {
    if (
      payload &&
      typeof payload === 'object' &&
      'payload' in payload &&
      'paginationMeta' in payload
    ) {
      const paginatedPayload = payload;

      return {
        data: paginatedPayload.payload,
        pagination: paginatedPayload.paginationMeta,
      };
    }

    return { data: payload };
  }

  private static resolveSuccessMessage(
    method?: string,
    statusCode?: number,
  ): string {
    if (statusCode === 201) {
      return SYS_MSG.CREATED;
    }

    if (statusCode === 202) {
      return SYS_MSG.ACCEPTED;
    }

    if (statusCode === 204) {
      return SYS_MSG.NO_CONTENT;
    }

    switch (method?.toUpperCase()) {
      case 'GET':
        return SYS_MSG.RETRIEVED;
      case 'POST':
        return SYS_MSG.SUCCESS;
      case 'PATCH':
      case 'PUT':
        return SYS_MSG.UPDATED;
      case 'DELETE':
        return SYS_MSG.DELETED;
      default:
        return SYS_MSG.SUCCESS;
    }
  }

  private static getRequestId(request?: Request): string | undefined {
    const requestId =
      request?.headers['x-request-id'] ?? request?.headers['x-correlation-id'];

    if (Array.isArray(requestId)) {
      return requestId[0];
    }

    if (typeof requestId === 'string' && requestId.trim()) {
      return requestId;
    }

    const fallbackRequest = request as Request & { id?: string };
    if (fallbackRequest?.id?.trim()) {
      return fallbackRequest.id;
    }

    return undefined;
  }
}
