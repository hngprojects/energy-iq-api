import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { StandardResponse } from '../responses/standard-response';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        if (response.statusCode === 204) return undefined;

        return StandardResponse.success(payload, {
          request,
          method: request.method,
          statusCode: response.statusCode,
        });
      }),
    );
  }
}
