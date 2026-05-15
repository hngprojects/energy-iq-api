import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * BrandApiException
 *
 * Thrown by brand adapters when the external cloud API returns a non-2xx response.
 * Carries the upstream HTTP status and message for structured error handling in the poller.
 */
export class BrandApiException extends HttpException {
  constructor(
    public readonly upstreamStatus: number,
    message: string,
  ) {
    super(
      {
        statusCode: upstreamStatus,
        message,
        error: 'Brand API Error',
      },
      upstreamStatus >= 400 && upstreamStatus < 500
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
