import { format } from 'date-fns';

const HEADER = (title: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f8fafc;margin:0;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
<div style="background:#8E51FF;padding:24px 32px;">
  <p style="color:#fff;font-size:18px;font-weight:600;margin:0;">Deep Impression</p>
</div>
<div style="padding:32px;">
  <p style="font-size:16px;font-weight:600;color:#0f172a;margin:0 0 8px;">${title}</p>`;

const FOOTER = `
  <p style="font-size:13px;color:#94a3b8;margin:24px 0 0;">This is an automated message from Deep Impression. Please do not reply.</p>
</div></div></body></html>`;

// ── Submitted (to reviewer + admins) ─────────────────────────────────────────

interface SubmittedProps {
  employeeName:   string;
  designation:    string;
  department:     string;
  date:           Date;
  type:           string;
  clockIn:        Date;
  clockOut?:      Date | null;
  reason:         string;
  loginUrl:       string;
}

export function regularizationSubmittedHtml({
  employeeName, designation, department, date, type, clockIn, clockOut, reason, loginUrl,
}: SubmittedProps): string {
  const typeLabel = type.replace(/_/g, ' ');
  const ciStr     = format(clockIn, 'hh:mm a');
  const coStr     = clockOut ? format(clockOut, 'hh:mm a') : 'Not specified';

  return `${HEADER(`${employeeName} raised an attendance regularization request`)}
  <p style="font-size:14px;color:#475569;margin:0 0 16px;">
    An employee has raised an attendance regularization request that requires your review.
  </p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Employee:</strong> ${employeeName} (${designation}, ${department})</p>
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Date:</strong> ${format(date, 'dd MMM yyyy (EEEE)')}</p>
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Type:</strong> ${typeLabel}</p>
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Requested Time:</strong> ${ciStr} → ${coStr}</p>
    <p style="margin:0;font-size:13px;color:#64748b;"><strong>Reason:</strong> ${reason}</p>
  </div>
  <a href="${loginUrl}/approvals?tab=regularization" style="display:inline-block;background:#8E51FF;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">Review Request →</a>
  ${FOOTER}`;
}

export function regularizationSubmittedSubject(employeeName: string): string {
  return `${employeeName} raised an attendance regularization request`;
}

// ── Approved (to employee) ────────────────────────────────────────────────────

interface ApprovedProps {
  employeeName:  string;
  date:          Date;
  clockIn:       Date;
  clockOut?:     Date | null;
  approvedBy:    string;
  loginUrl:      string;
}

export function regularizationApprovedHtml({
  employeeName, date, clockIn, clockOut, approvedBy, loginUrl,
}: ApprovedProps): string {
  const ciStr = format(clockIn, 'hh:mm a');
  const coStr = clockOut ? format(clockOut, 'hh:mm a') : 'N/A';

  return `${HEADER('Your attendance regularization was approved ✓')}
  <p style="font-size:14px;color:#475569;margin:0 0 16px;">Hi ${employeeName},</p>
  <p style="font-size:14px;color:#475569;margin:0 0 16px;">
    Your attendance regularization request has been approved and your attendance has been updated.
  </p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:0 0 6px;font-size:13px;color:#166534;"><strong>Date:</strong> ${format(date, 'dd MMM yyyy (EEEE)')}</p>
    <p style="margin:0 0 6px;font-size:13px;color:#166534;"><strong>Attendance recorded:</strong> ${ciStr} → ${coStr}</p>
    <p style="margin:0;font-size:13px;color:#166534;"><strong>Approved by:</strong> ${approvedBy}</p>
  </div>
  <a href="${loginUrl}/attendance" style="display:inline-block;background:#8E51FF;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">View Attendance →</a>
  ${FOOTER}`;
}

export function regularizationApprovedSubject(date: Date): string {
  return `Your attendance regularization for ${format(date, 'dd MMM yyyy')} has been approved ✓`;
}

// ── Rejected (to employee) ────────────────────────────────────────────────────

interface RejectedProps {
  employeeName:    string;
  date:            Date;
  rejectedBy:      string;
  remarks:         string;
  isFinalRejection: boolean; // true = rejected by admin (final), false = rejected by reviewer
  loginUrl:        string;
}

export function regularizationRejectedHtml({
  employeeName, date, rejectedBy, remarks, isFinalRejection, loginUrl,
}: RejectedProps): string {
  return `${HEADER('Your attendance regularization request was rejected')}
  <p style="font-size:14px;color:#475569;margin:0 0 16px;">Hi ${employeeName},</p>
  <p style="font-size:14px;color:#475569;margin:0 0 16px;">
    Your attendance regularization request for <strong>${format(date, 'dd MMM yyyy')}</strong> was rejected.
  </p>
  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:0 0 6px;font-size:13px;color:#991b1b;"><strong>Rejected by:</strong> ${rejectedBy}</p>
    <p style="margin:0;font-size:13px;color:#991b1b;"><strong>Reason:</strong> ${remarks}</p>
  </div>
  ${!isFinalRejection ? `
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:20px;">
    <p style="margin:0;font-size:13px;color:#92400e;">
      ℹ️ You can appeal to your HR administrator if you believe this decision is incorrect.
    </p>
  </div>
  <a href="${loginUrl}/attendance" style="display:inline-block;background:#8E51FF;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:500;">Contact Admin →</a>
  ` : ''}
  ${FOOTER}`;
}

export function regularizationRejectedSubject(date: Date): string {
  return `Your attendance regularization for ${format(date, 'dd MMM yyyy')} was rejected`;
}
