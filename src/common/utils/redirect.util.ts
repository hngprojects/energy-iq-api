import { ForbiddenException } from '@nestjs/common';
import { SYS_MSG } from '../constants/sys-msg';

export function ValidateRedirectUrl(
  url: string,
  allowedOrigins: string[],
): void {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new ForbiddenException(SYS_MSG.INVALID_REDIRECT_URL);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ForbiddenException(SYS_MSG.INVALID_REDIRECT_URL_PROTOCOL);
  }

  const isAllowed = allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === parsed.origin;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    throw new ForbiddenException(SYS_MSG.FORBIDDEN_REDIRECT_URL);
  }
}
