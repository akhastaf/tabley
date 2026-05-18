import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.client = key && !key.startsWith('re_xxx') ? new Resend(key) : null;
    this.from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@tabley.local';
  }

  async send(args: SendArgs) {
    if (!this.client) {
      this.logger.warn(
        `[email-noop] to=${args.to} subject="${args.subject}" — set RESEND_API_KEY to send for real`,
      );
      this.logger.debug(`[email-noop body] ${args.text ?? args.html.replace(/<[^>]+>/g, ' ')}`);
      return { id: 'noop' };
    }
    try {
      const res = await this.client.emails.send({
        from: this.from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      });
      if (res.error) {
        this.logger.error(`resend error: ${res.error.message}`);
        return { id: null };
      }
      return { id: res.data?.id ?? null };
    } catch (err) {
      this.logger.error(`resend threw: ${(err as Error).message}`);
      return { id: null };
    }
  }
}
