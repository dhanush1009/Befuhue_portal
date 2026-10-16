interface WelcomeEmployeeEmailProps {
  name:       string;
  email:      string;
  password:   string;
  loginUrl:   string;
  mustChange: boolean;
}

export function welcomeEmployeeEmailHtml({
  name, email, password, loginUrl, mustChange,
}: WelcomeEmployeeEmailProps): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 32px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #8E51FF; padding: 24px 32px;">
      <p style="color: #fff; font-size: 18px; font-weight: 600; margin: 0;">Deep Impression</p>
      <p style="color: #c7d2fe; font-size: 13px; margin: 4px 0 0;">Your account is ready</p>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin: 0 0 4px;">Welcome to Deep Impression, ${name}! 🎉</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">Your employee account has been created. Here are your login details:</p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0; width: 140px;">Portal URL</td>
            <td style="font-size: 13px; color: #0f172a; padding: 4px 0;">
              <a href="${loginUrl}" style="color: #8E51FF; text-decoration: none;">${loginUrl}</a>
            </td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0;">Email</td>
            <td style="font-size: 13px; color: #0f172a; padding: 4px 0;">${email}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #64748b; padding: 4px 0; vertical-align: top;">Temporary Password</td>
            <td style="padding: 4px 0;">
              <code style="display: inline-block; background: #1e293b; color: #e2e8f0; padding: 6px 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 0.05em;">${password}</code>
            </td>
          </tr>
        </table>
      </div>

      ${mustChange ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">
          🔒 You will be required to create a new password when you first sign in.
        </p>
      </div>` : ''}

      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #991b1b;">
          ⚠️ For security, please do not share these credentials with anyone.
        </p>
      </div>

      <a href="${loginUrl}" style="display: inline-block; background: #8E51FF; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
        Sign In Now →
      </a>

      <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0;">
        — The Deep Impression Team<br />
        This is an automated message. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export const welcomeEmployeeEmailSubject = 'Welcome to Deep Impression — Your account is ready';
