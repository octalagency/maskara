import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT', 587)),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    }
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    const from = this.config.get('SMTP_FROM', 'Maskara <noreply@maskara.bd>');

    if (!this.transporter) {
      this.logger.warn(`Email not sent (SMTP not configured): ${subject} → ${to}`);
      this.logger.log(`Body preview: ${html.slice(0, 120)}...`);
      return false;
    }

    await this.transporter.sendMail({ from, to, subject, html });
    this.logger.log(`Email sent: ${subject} → ${to}`);
    return true;
  }

  async sendVerificationEmail(email: string, token: string) {
    const url = `${this.config.get('FRONTEND_URL')}/verify-email?token=${token}`;
    return this.send(
      email,
      'Maskara — Email Verification',
      `<p>আপনার Maskara account verify করতে <a href="${url}">এখানে ক্লিক করুন</a></p><p>লিংক ২৪ ঘণ্টা valid।</p>`,
    );
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${this.config.get('FRONTEND_URL')}/reset-password?token=${token}`;
    return this.send(
      email,
      'Maskara — Password Reset',
      `<p>Password reset করতে <a href="${url}">এখানে ক্লিক করুন</a></p><p>লিংক ১ ঘণ্টা valid।</p>`,
    );
  }
}
