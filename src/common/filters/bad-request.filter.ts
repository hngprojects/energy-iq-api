import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StandardResponse } from '../responses/standard-response';

@Catch(BadRequestException)
export class BadRequestExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as {
      message: string | string[];
    };

    const messages = Array.isArray(exceptionResponse.message)
      ? exceptionResponse.message
      : [exceptionResponse.message];

    response.status(status).json({
      success: false,
      statusCode: status,
      error: 'Invalid Request',
      message: messages,
      meta: {
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });

    response.status(status).json(
      StandardResponse.error('Invalid request', {
        error: 'Invalid request',
        statusCode: 400,
      }),
    );
  }
}
