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
} from './email.jobs';

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
}
