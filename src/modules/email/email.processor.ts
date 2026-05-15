import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { appConfig } from '../../config/app.config';
import { type ConfigType } from '@nestjs/config';
import { Job } from 'bullmq';
import {
  EMAIL_JOBS,
  LinkExpiredJobData,
  PasswordResetJobData,
  PasswordUpdateJobData,
  VerifyEmailJobData,
  WelcomeJobData,
  ContactUsJobData,
} from './email.jobs';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { QUEUES } from '../../common/constants/queue';

@Processor(QUEUES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly resend: Resend;
  private readonly templateCache = new Map<
    string,
    HandlebarsTemplateDelegate
  >();

  constructor(
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {
    super();
    this.resend = new Resend(appCfg.resendApiKey);
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.name} [${job.id}]`);

    switch (job.name) {
      case EMAIL_JOBS.WELCOME:
        return this.handleWelcome(job as Job<WelcomeJobData>);
      case EMAIL_JOBS.PASSWORD_RESET:
        return this.handlePasswordReset(job as Job<PasswordResetJobData>);
      case EMAIL_JOBS.VERIFY_EMAIL:
        return this.handleVerifyEmail(job as Job<VerifyEmailJobData>);
      case EMAIL_JOBS.PASSWORD_UPDATE:
        return this.handlePasswordUpdate(job as Job<PasswordUpdateJobData>);
      case EMAIL_JOBS.LINK_EXPIRE:
        return this.handleLinkExpire(job as Job<LinkExpiredJobData>);
      case EMAIL_JOBS.CONTACT_US:
        return this.handleContactUs(job as Job<ContactUsJobData>);
      default: {
        const message = `Unknown job type: ${job.name}`;
        this.logger.warn(message);
        throw new Error(message);
      }
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  private async handleWelcome(job: Job<WelcomeJobData>): Promise<void> {
    const { to, firstName, clientUrl } = job.data;
    this.logger.log(`Sending welcome email to ${this.maskEmail(to)}`);
    const html = this.renderTemplate(EMAIL_JOBS.WELCOME, {
      firstName,
      clientUrl,
    });

    const fromAddress = this.appCfg.resendFrom;
    const { error } = await this.resend.emails.send({
      from: `Energy IQ <${fromAddress}>`,
      to,
      subject: `Welcome to Energy IQ`,
      html,
    });

    if (error) {
      this.logger.error(
        `Welcome email failed for ${this.maskEmail(to)}`,
        error.name,
        error.message,
        error.statusCode,
      );
      throw new Error(error.message);
    }

    this.logger.log(`Welcome email sent successfully to ${this.maskEmail(to)}`);
  }

  private async handlePasswordReset(
    job: Job<PasswordResetJobData>,
  ): Promise<void> {
    const { to, firstName, resetLink } = job.data;
    this.logger.log(`Sending password reset email to ${this.maskEmail(to)}`);
    const html = this.renderTemplate(EMAIL_JOBS.PASSWORD_RESET, {
      firstName,
      resetLink,
    });

    const fromAddress = this.appCfg.resendFrom;
    const { error } = await this.resend.emails.send({
      from: `Energy IQ <${fromAddress}>`,
      to,
      subject: 'Reset your password',
      html,
    });

    if (error) {
      this.logger.error(
        `Password reset email failed for ${this.maskEmail(to)}`,
        error.name,
        error.message,
        error.statusCode,
      );
      throw new Error(error.message);
    }

    this.logger.log(
      `Password reset email sent successfully to ${this.maskEmail(to)}`,
    );
  }

  private async handlePasswordUpdate(
    job: Job<PasswordUpdateJobData>,
  ): Promise<void> {
    const { to, firstName, clientUrl } = job.data;
    this.logger.log(`Sending password update email to ${this.maskEmail(to)}`);
    const html = this.renderTemplate(EMAIL_JOBS.PASSWORD_UPDATE, {
      firstName,
      clientUrl,
    });

    const fromAddress = this.appCfg.resendFrom;
    const { error } = await this.resend.emails.send({
      from: `Energy IQ <${fromAddress}>`,
      to,
      subject: 'Password Updated Successfully',
      html,
    });

    if (error) {
      this.logger.error(
        `Password update email failed for ${this.maskEmail(to)}`,
        error.name,
        error.message,
        error.statusCode,
      );
      throw new Error(error.message);
    }

    this.logger.log(
      `Password Update email sent successfully to ${this.maskEmail(to)}`,
    );
  }

  private async handleVerifyEmail(job: Job<VerifyEmailJobData>): Promise<void> {
    const { to, verifyCode, firstName } = job.data;
    this.logger.log(`Sending verify email to ${this.maskEmail(to)}`);
    const html = this.renderTemplate(EMAIL_JOBS.VERIFY_EMAIL, {
      verifyCode,
      firstName,
    });

    const fromAddress = this.appCfg.resendFrom;
    const { error } = await this.resend.emails.send({
      from: `Energy IQ <${fromAddress}>`,
      to,
      subject: 'Verify your email address',
      html,
    });

    if (error) {
      this.logger.error(
        `Verify email failed for ${this.maskEmail(to)}`,
        error.name,
        error.message,
        error.statusCode,
      );
      throw new Error(error.message);
    }

    this.logger.log(`Verify email sent successfully to ${this.maskEmail(to)}`);
  }

  private async handleLinkExpire(job: Job<LinkExpiredJobData>): Promise<void> {
    const { to, firstName, requestUrl } = job.data;
    this.logger.log(`Sending link expire email to ${this.maskEmail(to)}`);
    const html = this.renderTemplate(EMAIL_JOBS.LINK_EXPIRE, {
      firstName,
      requestUrl,
    });

    const fromAddress = this.appCfg.resendFrom;
    const { error } = await this.resend.emails.send({
      from: `Energy IQ<${fromAddress}>`,
      to,
      subject: 'Link expired',
      html,
    });

    if (error) {
      this.logger.error(
        `Link expire email failed for ${this.maskEmail(to)}`,
        error.name,
        error.message,
        error.statusCode,
      );
      throw new Error(error.message);
    }

    this.logger.log(
      `Link expire email sent successfully to ${this.maskEmail(to)}`,
    );
  }

  private async handleContactUs(job: Job<ContactUsJobData>): Promise<void> {
    const { firstName, lastName, email, message, phoneNumber } = job.data;
    this.logger.log(
      `Sending contact us notification for ${this.maskEmail(email)}`,
    );

    const fromAddress = this.appCfg.resendFrom;
    const supportInbox = this.appCfg.supportEmail;

    const { error } = await this.resend.emails.send({
      from: `Energy IQ <${fromAddress}>`,
      to: supportInbox,
      replyTo: email,
      subject: `Contact Us: Message from ${firstName} ${lastName}`,
      html: `
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phoneNumber ? `<p><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    });

    if (error) {
      this.logger.error(
        `Contact us email failed for ${this.maskEmail(email)}`,
        error.name,
        error.message,
        error.statusCode,
      );
      throw new Error(error.message);
    }

    this.logger.log(
      `Contact us email sent successfully for ${this.maskEmail(email)}`,
    );
  }

  private renderTemplate(
    name: string,
    context: Record<string, unknown>,
  ): string {
    if (!this.templateCache.has(name)) {
      const filePath = path.join(__dirname, 'templates', `${name}.hbs`);
      const source = fs.readFileSync(filePath, 'utf8');
      this.templateCache.set(name, Handlebars.compile(source));
    }
    return this.templateCache.get(name)!(context);
  }
}
