import { z } from 'zod';

// ── Create (onboard) new employee — ADMIN only ────────────────────────────────
export const createEmployeeSchema = z.object({
  firstName:                 z.string().min(2).max(50),
  lastName:                  z.string().min(2).max(50),
  email:                     z.string().email(),
  designation:               z.string().min(1).max(100),
  department:                z.string().min(1).max(100),
  role:                      z.enum(['EMPLOYEE', 'ADMIN']),
  managerId:                 z.string().optional().nullable(),
  phone:                     z.string().max(20).optional().nullable(),
  joiningDate:               z.string().min(1),
  employmentType:            z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']),
  // Password / console access
  consoleAccess:             z.boolean().default(true),
  passwordType:              z.enum(['AUTO', 'CUSTOM']).default('AUTO'),
  customPassword:            z.string().optional(),
  mustChangePasswordOnLogin: z.boolean().default(true),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ── Fields any user can update on their own profile ───────────────────────────
export const updateOwnProfileSchema = z.object({
  name:                     z.string().min(1).max(100).optional(),
  phone:                    z.string().max(20).optional().nullable(),
  avatarUrl:                z.string().optional().nullable(),
  fatherName:               z.string().max(100).optional().nullable(),
  motherName:               z.string().max(100).optional().nullable(),
  parentsPhone:             z.string().max(20).optional().nullable(),
  bondCertificateSubmitted: z.boolean().optional(),
});

// ── Fields ADMIN can update on any employee ───────────────────────────────────
export const updateEmployeeSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  email:          z.string().email().optional(),
  phone:          z.string().max(20).optional().nullable(),
  avatarUrl:      z.string().optional().nullable(),
  department:     z.string().max(100).optional().nullable(),
  designation:    z.string().max(100).optional().nullable(),
  managerId:      z.string().optional().nullable(),
  role:           z.enum(['EMPLOYEE', 'ADMIN']).optional(),
  isActive:       z.boolean().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT']).optional().nullable(),
  joiningDate:    z.string().optional().nullable(),
  attendanceMode: z.enum(['CLOCK_IN', 'ANYWHERE']).optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(['EMPLOYEE', 'ADMIN']),
});

// ── Change password (settings + force-change) ───────────────────────────────
export const changePasswordSchema = z.object({
  // present when changing from settings (not force-change)
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8, 'Min 8 characters'),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
export type UpdateEmployeeInput   = z.infer<typeof updateEmployeeSchema>;
export type ChangeRoleInput       = z.infer<typeof changeRoleSchema>;
