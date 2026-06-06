import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { type Request } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const client = req.query['client'] as string | undefined;
    // If client is web, they might pass a redirect_uri as a query param;
    const redirectUri = req.query['redirect_uri'] as string | undefined;
    return {
      state:
        client === 'mobile'
          ? 'mobile'
          : redirectUri
            ? `web:${redirectUri}`
            : 'web',
    };
  }
}
