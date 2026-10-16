interface PasswordResetEmailProps {
  name:         string;
  email:        string;
  newPassword:  string;
  loginUrl:     string;
  resetByName:  string;
  mustChange:   boolean;
}

export function passwordResetEmailHtml({
  name, email, newPassword, loginUrl, resetByName, mustChange,
}: PasswordResetEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Inter, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 32px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #8E51FF; padding: 24px 32px;">
      <p style="color: #fff; font-size: 18px; font-weight: 600; margin: 0;">Deep Impression</p>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 8px;">Your password has been reset</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">Hi ${name},</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
        Your Deep Impression password has been reset by <strong>${resetByName}</strong> (Administrator).
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;"><strong>Portal URL:</strong> <a href="${loginUrl}" style="color: #8E51FF;">${loginUrl}</a></p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>New Password:</strong> <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 13px;">${newPassword}</code></p>
      </div>
      ${mustChange ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">⚠️ You will be required to set a new password when you sign in.</p>
      </div>` : ''}
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #991b1b;">If you did not expect this change, please contact your HR administrator immediately.</p>
      </div>
      <a href="${loginUrl}" style="display: inline-block; background: #8E51FF; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">Sign In Now</a>
      <p style="font-size: 13px; color: #94a3b8; margin: 24px 0 0;">This is an automated message from Deep Impression. Please do not reply.</p>
    </div>
  </div>
</body>
</html>`;
}

export function passwordResetEmailSubject(): string {
  return 'Your Deep Impression password has been reset';
}
