import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { QUEUES } from '../../common/constants/queue';
import { Queue } from 'bullmq';
import {
  EMAIL_JOBS,
  LinkExpiredJobData,
  PasswordResetJobData,
  PasswordUpdateJobData,
  VerifyEmailJobData,
  WelcomeJobData,
  ContactUsJobData,
  AlertNotificationJobData,
  WaitlistJoinedJobData,
} from './email.jobs';
import { AlertSeverity, AlertType } from '../../common/enums';

@Injectable()
export class EmailService {
  constructor(@InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue) {}

  async sendWelcome(
    to: string,
    firstName: string,
    clientUrl: string,
  ): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.WELCOME, {
      to,
      firstName,
      clientUrl,
    } satisfies WelcomeJobData);
  }

  async sendPasswordReset(
    to: string,
    resetLink: string,
    firstName: string,
  ): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.PASSWORD_RESET, {
      to,
      resetLink,
      firstName,
    } satisfies PasswordResetJobData);
  }

  async sendPasswordUpdate(
    to: string,
    clientUrl: string,
    firstName: string,
  ): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.PASSWORD_UPDATE, {
      to,
      clientUrl,
      firstName,
    } satisfies PasswordUpdateJobData);
  }

  async sendLinkExpire(
    to: string,
    requestUrl: string,
    firstName: string,
  ): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.LINK_EXPIRE, {
      to,
      requestUrl,
      firstName,
    } satisfies LinkExpiredJobData);
  }

  async sendVerifyEmail(
    to: string,
    firstName: string,
    verifyCode: string,
    clientUrl: string,
  ): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.VERIFY_EMAIL, {
      to,
      firstName,
      verifyCode,
      clientUrl,
    } satisfies VerifyEmailJobData);
  }

  async sendContactUs(
    firstName: string,
    lastName: string,
    email: string,
    message: string,
    phoneNumber?: string,
  ): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.CONTACT_US, {
      firstName,
      lastName,
      email,
      message,
      phoneNumber,
    } satisfies ContactUsJobData);
  }

  async sendAlert(
    to: string,
    message: string,
    firstName: string,
    dashboardUrl: string,
    alertType: AlertType,
    alertSeverity: AlertSeverity,
  ): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.ALERT_ALERT, {
      to,
      message,
      firstName,
      dashboardUrl,
      alertType,
      alertSeverity,
    } satisfies AlertNotificationJobData);
  }

  async sendWaitlistJoinedEmail(toEmail: string, year: number): Promise<void> {
    await this.emailQueue.add(EMAIL_JOBS.WAITLIST_JOINED, {
      to: toEmail,
      year: year.toString(),
    } satisfies WaitlistJoinedJobData);
  }
}
