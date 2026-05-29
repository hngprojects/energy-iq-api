import { AlertSeverity, AlertType } from '../../common/enums';

export const EMAIL_JOBS = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password-reset',
  VERIFY_EMAIL: 'verify-email',
  PASSWORD_UPDATE: 'password-update',
  LINK_EXPIRE: 'link-expire',
  CONTACT_US: 'contact-us',
  ALERT_ALERT: 'alert-notification',
  WAITLIST_JOINED: 'waitlist-joined',
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

export interface ContactUsJobData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  message: string;
}

export interface AlertStat {
  label: string;
  value: string;
}

export interface AlertNotificationJobData {
  to: string;
  firstName: string;
  alertType: AlertType;
  alertSeverity: AlertSeverity;
  // Human-readable explanation of why this alert fired.
  alertReason: string;
  // Link to the dashboard / alert resolution page
  resolveLink: string;
  /**
   * Dynamic list of 1–N stat cards rendered with {{#each stats}}.
   * The processor computes `statWidth` (100 / stats.length) and passes it
   * alongside the array so the template can size columns correctly.
   * Used by both CRITICAL and WARNING templates.
   */
  stats?: AlertStat[];
  /** Title shown in the email header (e.g. "Battery depletion warning"). */
  alertTitle?: string;
}

export interface WaitlistJoinedJobData {
  to: string;
  year: string;
}

export type EmailJobData =
  | WelcomeJobData
  | PasswordResetJobData
  | VerifyEmailJobData
  | PasswordUpdateJobData
  | LinkExpiredJobData
  | ContactUsJobData
  | AlertNotificationJobData;
