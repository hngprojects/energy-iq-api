import * as crypto from 'crypto';

export const generateOtp = (): string => {
  const codeLength = 6;
  let code = '';

  for (let i = 0; i < codeLength; i++) {
    code += crypto.randomInt(0, 10).toString();
  }

  return code;
};
