import nodemailer from 'nodemailer';

export const EMAIL_FROM = process.env.SMTP_FROM ?? 'noreply@your-domain.example';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface SendEmailOptions {
  to:      string;
  subject: string;
  html:    string;
  from?:   string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;

  if (!host || !user) {
    console.log(`[mailer:dev] SMTP credentials not set. Simulated email to: ${to} | Subject: "${subject}"`);
    return;
  }

  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from:    from ?? `Befhue <${EMAIL_FROM}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`[mailer] Failed to send email to ${to}:`, err);
    throw err;
  }
}

