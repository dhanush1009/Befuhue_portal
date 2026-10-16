import { LEAVE_TYPES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

interface LeaveRejectedEmailProps {
  employeeName: string;
  leaveType:    string;
  fromDate:     Date;
  toDate:       Date;
  remarks:      string;
}

export function leaveRejectedHtml({
  employeeName, leaveType, fromDate, toDate, remarks,
}: LeaveRejectedEmailProps): string {
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
      <p style="font-size: 16px; font-weight: 600; color: #0f172a; margin: 0 0 8px;">Leave Request Update</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">Hi ${employeeName},</p>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
        Your <strong>${typeLabel}</strong> request from <strong>${from}</strong> to <strong>${to}</strong>
        has been <span style="color: #dc2626; font-weight: 600;">rejected</span>.
      </p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 13px; color: #991b1b; font-weight: 600;">Reason:</p>
        <p style="margin: 0; font-size: 13px; color: #7f1d1d;">${remarks}</p>
      </div>
      <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
        If you have questions, please speak with your manager directly.
      </p>
      <p style="font-size: 13px; color: #94a3b8; margin: 0;">
        This is an automated message from Deep Impression. Please do not reply.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function leaveRejectedSubject(leaveType: string): string {
  const typeLabel = LEAVE_TYPES.find((t) => t.value === leaveType)?.label ?? leaveType;
  return `Your ${typeLabel} request was not approved`;
}
