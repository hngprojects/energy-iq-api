export const EMAIL_JOBS = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password-reset',
  VERIFY_EMAIL: 'verify-email',
  PASSWORD_UPDATE: 'password-update',
  LINK_EXPIRE: 'link-expire',
} as const;

// clientUrl here is the redirect to login
export interface WelcomeJobData {
  to: string;
  firstName: string;
  clientUrl: string;
}

export interface PasswordResetJobData {
  to: string;
  resetLink: string;
  firstName: string;
}

export interface VerifyEmailJobData {
  to: string;
  verifyCode: string;
  firstName: string;
  clientUrl: string;
}

// Note: The clientUrl here is the redirect straight to the login page
export interface PasswordUpdateJobData {
  to: string;
  firstName: string;
  clientUrl: string;
}

export interface LinkExpiredJobData {
  to: string;
  firstName: string;
  requestUrl: string;
}

export type EmailJobData =
  | WelcomeJobData
  | PasswordResetJobData
  | VerifyEmailJobData
  | PasswordUpdateJobData
  | LinkExpiredJobData;
