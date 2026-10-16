import { LEAVE_TYPES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

interface LeaveApprovedEmailProps {
  employeeName: string;
  leaveType:    string;
  fromDate:     Date;
  toDate:       Date;
  days:         number;
  managerName:  string;
}

export function leaveApprovedHtml({
  employeeName, leaveType, fromDate, toDate, days, managerName,
}: LeaveApprovedEmailProps): string {
  const typeLabel = LEAVE_TYPES.find((t) => t.value === leaveType)?.label ?? leaveType;
  const from = formatDate(fromDate);
  const to   = formatDate(toDate);

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
      <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 8px;">Leave Approved ✓</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">Hi ${employeeName},</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
        Your <strong>${typeLabel}</strong> from <strong>${from}</strong> to <strong>${to}</strong>
        (${days} day${days !== 1 ? 's' : ''}) has been <span style="color: #16a34a; font-weight: 600;">approved</span>
        by <strong>${managerName}</strong>.
      </p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 13px; color: #166534;">
          <strong>Leave Type:</strong> ${typeLabel}<br/>
          <strong>From:</strong> ${from}<br/>
          <strong>To:</strong> ${to}<br/>
          <strong>Duration:</strong> ${days} day${days !== 1 ? 's' : ''}
        </p>
      </div>
      <p style="font-size: 13px; color: #94a3b8; margin: 0;">
        This is an automated message from Deep Impression. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function leaveApprovedSubject(leaveType: string): string {
  const typeLabel = LEAVE_TYPES.find((t) => t.value === leaveType)?.label ?? leaveType;
  return `Your ${typeLabel} has been approved`;
}
