import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const requestId = headers['x-request-id'] || randomUUID();

    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;

        this.logger.log(
          JSON.stringify({
            requestId,
            method,
            url,
            statusCode: response.statusCode,
            duration: `${ms}ms`,
            ip,
            userAgent,
          }),
        );
      }),
      catchError((error: unknown) => {
        const ms = Date.now() - start;
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        this.logger.error(
          JSON.stringify({
            requestId,
            method,
            url,
            statusCode: response.statusCode,
            duration: `${ms}ms`,
            ip,
            userAgent,
            error: errorMessage,
          }),
        );

        return throwError(() => error);
      }),
    );
  }
}
