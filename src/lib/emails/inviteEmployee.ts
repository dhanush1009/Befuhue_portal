interface InviteEmployeeEmailProps {
  name:        string;
  email:       string;
  role:        string;
  department?: string | null;
  acceptUrl:   string;
  expiresInDays?: number;
}

export const inviteEmployeeEmailSubject = "You're invited to join Befhue Workspace";

export function inviteEmployeeEmailHtml({
  name,
  email,
  role,
  department,
  acceptUrl,
  expiresInDays = 7,
}: InviteEmployeeEmailProps): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to join Befhue</title>
</head>
<body style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background: #09090b; color: #f4f4f5; margin: 0; padding: 40px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background: #131317; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #FF002C 0%, #B8001F 100%); padding: 32px 36px; text-align: left;">
      <div style="display: inline-block; background: rgba(0,0,0,0.25); padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #ffffff; margin-bottom: 12px;">
        Workspace Invitation
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: 0.03em;">Befhue</h1>
      <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 6px 0 0; letter-spacing: 0.02em;">Agency, Client & Team Portal</p>
    </div>

    <!-- Body -->
    <div style="padding: 36px;">
      <p style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 0 0 8px; letter-spacing: 0.02em;">
        Welcome to the team, ${name}! 👋
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 28px; letter-spacing: 0.02em;">
        You have been invited by your administrator to join the <strong style="color: #ffffff;">Befhue</strong> workspace. Please accept your invitation below to set up your password and activate your account.
      </p>

      <!-- Invitation Card -->
      <div style="background: #18181d; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 22px; margin-bottom: 28px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; padding: 6px 0; width: 130px;">Full Name</td>
            <td style="font-size: 14px; font-weight: 600; color: #ffffff; padding: 6px 0;">${name}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; padding: 6px 0;">Work Email</td>
            <td style="font-size: 14px; font-weight: 600; color: #ffffff; padding: 6px 0;">${email}</td>
          </tr>
          <tr>
            <td style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; padding: 6px 0;">Role / Access</td>
            <td style="font-size: 14px; font-weight: 600; color: #ffffff; padding: 6px 0;">${role}</td>
          </tr>
          ${department ? `
          <tr>
            <td style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; padding: 6px 0;">Department</td>
            <td style="font-size: 14px; font-weight: 600; color: #ffffff; padding: 6px 0;">${department}</td>
          </tr>` : ''}
        </table>
      </div>

      <!-- Call to Action -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${acceptUrl}" style="display: inline-block; background: #FF002C; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: 0.04em; box-shadow: 0 4px 20px rgba(255,0,44,0.35);">
          Accept Invitation & Set Password →
        </a>
        <p style="font-size: 12px; color: #71717a; margin: 12px 0 0; letter-spacing: 0.02em;">
          This invite link will expire in ${expiresInDays} days.
        </p>
      </div>

      <!-- Plain URL fallback -->
      <div style="background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; padding: 14px; margin-bottom: 20px;">
        <p style="font-size: 11px; color: #71717a; margin: 0 0 6px;">Button not working? Copy and paste this URL into your browser:</p>
        <p style="font-size: 12px; color: #FF002C; word-break: break-all; margin: 0; font-family: monospace;">
          ${acceptUrl}
        </p>
      </div>

      <!-- Flow explanation -->
      <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; font-size: 12px; color: #71717a; line-height: 1.5;">
        After accepting the invite and creating your password, you will be redirected to the sign-in page to log in to your workspace.
      </div>
    </div>
  </div>
</body>
</html>`;
}
