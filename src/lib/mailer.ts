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

  const isGmail =
    service === 'gmail' ||
    host === 'smtp.gmail.com' ||
    (user && (user.endsWith('@gmail.com') || user.endsWith('@befhue.com')));

  if (isGmail && user && pass) {
    // Nodemailer's built-in 'gmail' service is recommended for Vercel/serverless
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } else if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } else {
    // When SMTP credentials are not set on the hosting server
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV?.includes('preview')) {
      throw new Error(
        'Email service not configured. Please add SMTP_USER and SMTP_PASS to your hosting (Vercel) Environment Variables.',
      );
    }

    // Development fallback using Ethereal
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
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  try {
    const fromAddress =
      process.env.SMTP_FROM && !process.env.SMTP_FROM.includes('your-domain.example')
        ? process.env.SMTP_FROM
        : user
        ? `Befhue <${user}>`
        : `Befhue <${EMAIL_FROM}>`;

    const sender = from ?? fromAddress;
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


