import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtp.host');
    if (!host) {
      return;
    }
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('smtp.port') ?? 587,
      secure: this.config.get<boolean>('smtp.secure') ?? false,
      auth: this.config.get<string>('smtp.user')
        ? {
            user: this.config.get<string>('smtp.user'),
            pass: this.config.get<string>('smtp.pass') ?? '',
          }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[mail fallback] to=${message.to} subject=${message.subject}\n${message.text}`,
      );
      return;
    }
    const from =
      this.config.get<string>('smtp.from') ?? 'task-planner@localhost';
    await this.transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
