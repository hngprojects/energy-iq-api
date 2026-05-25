import { BadRequestException } from '@nestjs/common';
import { SYS_MSG } from '../constants/sys-msg';

export function validateSandboxToken(
  token: string,
  allowedTokens: string[],
): void {
  const parsed: string = token.toLowerCase();

  const isAllowed = allowedTokens.some((token) => {
    return token.toLowerCase() === parsed;
  });

  if (!isAllowed) {
    throw new BadRequestException(SYS_MSG.SANDBOX_CONNECTION_FAILED);
  }
}
