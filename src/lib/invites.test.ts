import { describe, it, expect } from 'vitest';
import { createInvitePayload, parseInviteToken } from './invites';
import { inviteEmployeeEmailHtml, inviteEmployeeEmailSubject } from './emails/inviteEmployee';

describe('Employee Invitation System', () => {
  describe('createInvitePayload', () => {
    it('generates a 64-character hex token with 7-day expiration', () => {
      const payload = createInvitePayload(7);
      expect(payload.token).toHaveLength(64);
      expect(payload.tempPassword).toMatch(/^INVITE:[a-f0-9]{64}:\d+$/);
      expect(payload.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
      expect(payload.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000 + 5000);
    });
  });

  describe('parseInviteToken', () => {
    it('correctly parses token and expiresAt from valid tempPassword', () => {
      const now = Date.now() + 100000;
      const raw = `INVITE:abc12345def:${now}`;
      const parsed = parseInviteToken(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.token).toBe('abc12345def');
      expect(parsed?.expiresAt.getTime()).toBe(now);
    });

    it('returns null for empty or non-invite strings', () => {
      expect(parseInviteToken(null)).toBeNull();
      expect(parseInviteToken('')).toBeNull();
      expect(parseInviteToken('regular_temp_password_123')).toBeNull();
      expect(parseInviteToken('INVITE:')).toBeNull();
      expect(parseInviteToken('INVITE:tokenonly')).toBeNull();
    });
  });

  describe('inviteEmployeeEmailHtml', () => {
    it('renders responsive HTML containing acceptUrl, employee name, and branding', () => {
      const html = inviteEmployeeEmailHtml({
        name:       'Rohan Verma',
        email:      'rohan@befhue.com',
        role:       'EMPLOYEE',
        department: 'Design',
        acceptUrl:  'http://localhost:3000/accept-invite/mock-token-xyz',
      });

      expect(inviteEmployeeEmailSubject).toBe("You're invited to join Befhue Workspace");
      expect(html).toContain('Rohan Verma');
      expect(html).toContain('rohan@befhue.com');
      expect(html).toContain('Design');
      expect(html).toContain('http://localhost:3000/accept-invite/mock-token-xyz');
      expect(html).toContain('Accept Invitation & Set Password');
      expect(html).toContain('Befhue');
    });
  });
});
