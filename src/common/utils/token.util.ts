import { BadRequestException } from '@nestjs/common';

export function validateSandboxToken(
  token: string,
  allowedTokens: string[],
): void {
  const parsed: string = token.toLowerCase();

  const isAllowed = allowedTokens.some((token) => {
    return token.toLowerCase() === parsed;
  });

  if (!isAllowed) {
    throw new BadRequestException(
      'Could not connect to your Sandbox Inverter. Check your access token',
    );
  }
}
