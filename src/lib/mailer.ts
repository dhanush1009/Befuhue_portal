import nodemailer from 'nodemailer';

export const EMAIL_FROM = process.env.SMTP_FROM ?? 'noreply@your-domain.example';

interface SendEmailOptions {
  to:      string;
  subject: string;
  html:    string;
  from?:   string;
}

export interface SendEmailResult {
  success:     boolean;
  messageId?:  string;
  previewUrl?: string | null;
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const service = process.env.SMTP_SERVICE?.trim();

  let transporter: nodemailer.Transporter;

  if (host && user) {
    transporter = nodemailer.createTransport({
      host,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
      auth: {
        user,
        pass: pass ?? '',
      },
    });
  } else if (service === 'gmail' && user && pass) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  } else {
    // Development / unconfigured SMTP fallback:
    // Create an ethereal test account using Nodemailer so a real email is sent to a test inbox
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[mailer] Using Ethereal test inbox for Nodemailer (${testAccount.user})`);
    } catch {
      // Fallback JSON transport if internet is unavailable for Ethereal
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  try {
    const sender = from ?? `Befhue <${EMAIL_FROM}>`;
    const info = await transporter.sendMail({
      from: sender,
      to,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    console.log(`[mailer] Invitation email dispatched via Nodemailer to ${to} (MessageId: ${info.messageId})`);
    if (previewUrl) {
      console.log(`[mailer] Nodemailer Email Preview URL: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl ? String(previewUrl) : null,
    };
  } catch (err) {
    console.error(`[mailer] Failed to send email to ${to} via Nodemailer:`, err);
    throw err;
  }
}


