import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

export interface SendInviteParams {
  firstName:       string;
  lastName:        string;
  email:           string;
  role?:           Role;
  department?:     string | null;
  designation?:    string | null;
  phone?:          string | null;
  employmentType?: string | null;
  joiningDate?:    string | Date | null;
  managerId?:      string | null;
  invitedById:     string;
  baseUrl?:        string;
}

export interface InviteInfo {
  id:          string;
  name:        string;
  email:       string;
  role:        string;
  department:  string | null;
  designation: string | null;
  expiresAt:   Date;
}

const INVITE_PREFIX = 'INVITE:';
const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Generate a secure 64-character invite token and tempPassword encoding.
 */
export function createInvitePayload(expiresInDays: number = DEFAULT_EXPIRY_DAYS) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAtMs = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const tempPassword = `${INVITE_PREFIX}${token}:${expiresAtMs}`;
  return { token, expiresAtMs, expiresAt: new Date(expiresAtMs), tempPassword };
}

/**
 * Parses an invite token from a user's tempPassword string.
 */
export function parseInviteToken(tempPassword: string | null | undefined): { token: string; expiresAt: Date } | null {
  if (!tempPassword || !tempPassword.startsWith(INVITE_PREFIX)) return null;
  const parts = tempPassword.slice(INVITE_PREFIX.length).split(':');
  if (parts.length < 2) return null;
  const token = parts[0];
  const expiresAtMs = Number(parts[1]);
  if (!token || isNaN(expiresAtMs)) return null;
  return { token, expiresAt: new Date(expiresAtMs) };
}

/**
 * Look up an invite by token.
 */
export async function getInviteByToken(token: string) {
  if (!token || typeof token !== 'string') return null;

  // Search user whose tempPassword contains this token
  const user = await prisma.user.findFirst({
    where: {
      tempPassword: {
        startsWith: `${INVITE_PREFIX}${token}:`,
      },
    },
    select: {
      id:           true,
      name:         true,
      email:        true,
      role:         true,
      department:   true,
      designation:  true,
      isActive:     true,
      passwordHash: true,
      hashedPassword: true,
      tempPassword: true,
    },
  });

  if (!user) return null;

  const parsed = parseInviteToken(user.tempPassword);
  if (!parsed) return null;

  const isExpired = Date.now() > parsed.expiresAt.getTime();
  const isAlreadyActive = user.isActive && (!!user.passwordHash || !!user.hashedPassword);

  return {
    user,
    token: parsed.token,
    expiresAt: parsed.expiresAt,
    isExpired,
    isAlreadyActive,
  };
}

/**
 * Accept an invite: validate, hash password, activate account, clear invite token.
 */
export async function acceptInviteByToken(token: string, newPassword: string) {
  const result = await getInviteByToken(token);
  if (!result) {
    throw new Error('INVITE_NOT_FOUND');
  }

  if (result.isExpired) {
    throw new Error('INVITE_EXPIRED');
  }

  if (result.isAlreadyActive) {
    throw new Error('INVITE_ALREADY_ACCEPTED');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('PASSWORD_TOO_SHORT');
  }

  const hash = await bcryptjs.hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { id: result.user.id },
    data: {
      isActive:                  true,
      passwordHash:              hash,
      hashedPassword:            hash,
      tempPassword:              null,
      passwordSetBy:             'SELF',
      passwordChangedAt:         new Date(),
      mustChangePasswordOnLogin: false,
    },
    select: {
      id:    true,
      email: true,
      name:  true,
    },
  });

  return updatedUser;
}
