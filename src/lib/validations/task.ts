import { z } from 'zod';

const TASK_STATUS_VALUES = ['TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED'] as const;
// Legacy values accepted on read/update so old data and history round-trip cleanly.
const ALL_STATUS_VALUES  = ['TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED', 'OPEN', 'READY_FOR_QA', 'IN_TESTING', 'VERIFIED'] as const;

export const createTaskSchema = z.object({
  title:            z.string().min(1, 'Title is required').max(200),
  clientId:         z.string().min(1, 'Client is required'),
  projectId:        z.string().optional(),
  description:      z.string().optional(),
  assigneeId:       z.string().optional(),
  priority:         z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
  status:           z.enum(TASK_STATUS_VALUES).default('TO_DO'),
  startDate:        z.string().nullable().optional(),
  dueDate:          z.string().optional(),
  parentId:         z.string().optional(),
  estimatedHours:   z.number({ error: 'Estimated hours is required' }).min(0).max(999).default(0),
  estimatedMinutes: z.number({ error: 'Estimated minutes is required' }).min(0).max(59).default(0),
  team:                z.enum(['MARKETING', 'DESIGN', 'DEV']).optional(),
  dependsOn:           z.array(z.string()).default([]),
  isGate:              z.boolean().default(false),
  isPrivate:           z.boolean().default(false),
  assignMode:          z.enum(['SINGLE', 'TOGETHER', 'OFFER']).default('SINGLE'),
  people:              z.array(z.object({ userId: z.string().min(1), role: z.string().max(40).optional() })).default([]),
  agencyName:          z.string().optional(),
  amount:              z.number().min(0).nullable().optional(),
  currency:            z.string().default('INR'),
  billingReference:    z.string().optional(),
}).refine(
  (d) => (d.estimatedHours * 60 + d.estimatedMinutes) > 0,
  { message: 'Estimated effort is required. Please enter at least 1 minute.', path: ['estimatedHours'] },
);

export const doneTaskSchema = z.object({
  status:         z.literal('DONE'),
  actualHours:    z.number({ error: 'Actual hours is required' }).min(0).max(999),
  actualMinutes:  z.number({ error: 'Actual minutes is required' }).min(0).max(59),
  completionNote: z.string().max(200).optional(),
}).refine(
  (d) => (d.actualHours * 60 + d.actualMinutes) > 0,
  { message: 'Actual effort is required to mark as Done.', path: ['actualHours'] },
);

// Keep closeTaskSchema as alias for backwards compat
export const closeTaskSchema = z.object({
  status:         z.literal('CLOSED'),
  actualHours:    z.number({ error: 'Actual hours is required' }).min(0).max(999),
  actualMinutes:  z.number({ error: 'Actual minutes is required' }).min(0).max(59),
  completionNote: z.string().max(200).optional(),
}).refine(
  (d) => (d.actualHours * 60 + d.actualMinutes) > 0,
  { message: 'Actual effort is required to close a task.', path: ['actualHours'] },
);

export const updateTaskSchema = z.object({
  title:            z.string().min(1).max(200).optional(),
  status:           z.enum(ALL_STATUS_VALUES).optional(),
  priority:         z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  assigneeId:       z.string().nullable().optional(),
  startDate:        z.string().nullable().optional(),
  dueDate:          z.string().nullable().optional(),
  description:      z.string().optional(),
  estimatedMinutes: z.number().min(1).optional(),
  actualMinutes:    z.number().min(1).optional(),
  completionNote:   z.string().max(200).optional(),
  clientId:            z.string().optional(),
  projectId:           z.string().nullable().optional(),
  team:                z.enum(['MARKETING', 'DESIGN', 'DEV']).nullable().optional(),
  phase:               z.enum(['RESEARCH', 'FORECAST', 'BUILD', 'LAUNCH', 'OPTIMIZE']).nullable().optional(),
  dependsOn:           z.array(z.string()).optional(),
  isGate:              z.boolean().optional(),
  isPrivate:           z.boolean().optional(),
  needsClientApproval: z.boolean().optional(),
  reviewerChain:       z.array(z.string()).optional(),
  deliverableLinks:    z.array(z.object({ label: z.string(), url: z.string() })).optional(),
  agencyName:          z.string().nullable().optional(),
  amount:              z.number().min(0).nullable().optional(),
  currency:            z.string().optional(),
  billingReference:    z.string().nullable().optional(),
});

export const taskCommentSchema = z.object({
  body:             z.record(z.string(), z.unknown()),
  bodyText:         z.string().min(1, 'Comment cannot be empty'),
  mentionedUserIds: z.array(z.string()).default([]),
});

export const reopenBugSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason for reopening (min 5 chars)').max(300),
});

export type CreateTaskInput  = z.infer<typeof createTaskSchema>;
export type DoneTaskInput    = z.infer<typeof doneTaskSchema>;
export type CloseTaskInput   = z.infer<typeof closeTaskSchema>;
export type UpdateTaskInput  = z.infer<typeof updateTaskSchema>;
export type TaskCommentInput = z.infer<typeof taskCommentSchema>;
export type ReopenBugInput   = z.infer<typeof reopenBugSchema>;

// ── Bug schemas ───────────────────────────────────────────────────────────────

export const bugEnvironmentSchema = z.object({
  browser:    z.string().optional(),
  os:         z.string().optional(),
  appVersion: z.string().optional(),
  device:     z.string().optional(),
});

export const createBugSchema = z.object({
  title:            z.string().min(1, 'Bug title is required').max(200),
  clientId:         z.string().min(1, 'Client is required'),
  projectId:        z.string().optional(),
  description:      z.string().optional(),
  assigneeId:       z.string().optional(),
  priority:         z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
  dueDate:          z.string().optional(),
  estimatedHours:   z.number().min(0).max(999),
  estimatedMinutes: z.number().min(0).max(59),
  severity:         z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], {
                      error: 'Severity is required.',
                    }),
  stepsToReproduce: z.array(z.string()).min(1, 'At least one step is required.')
                     .refine((steps) => steps.some((s) => s.trim().length > 0), {
                       message: 'At least one step must not be empty.',
                     }),
  expectedBehavior: z.string().min(1, 'Expected behavior is required.').max(1000),
  actualBehavior:   z.string().min(1, 'Actual behavior is required.').max(1000),
  environment:      bugEnvironmentSchema.optional(),
  affectedVersion:  z.string().max(50).optional(),
  itemType:         z.literal('BUG'),
}).refine(
  (data) => (data.estimatedHours * 60 + data.estimatedMinutes) > 0,
  { message: 'Estimated effort is required.', path: ['estimatedHours'] },
);

export const verifiedBugSchema = z.object({
  status:          z.literal('VERIFIED'),
  actualHours:     z.number().min(0).max(999),
  actualMinutes:   z.number().min(0).max(59),
  fixedInVersion:  z.string().max(50).optional(),
  completionNote:  z.string().max(200).optional(),
}).refine(
  (data) => (data.actualHours * 60 + data.actualMinutes) > 0,
  { message: 'Actual effort is required to verify a bug.', path: ['actualHours'] },
);

export const closeBugSchema = z.object({
  status:          z.literal('CLOSED'),
  actualHours:     z.number().min(0).max(999),
  actualMinutes:   z.number().min(0).max(59),
  fixedInVersion:  z.string().max(50).optional(),
  completionNote:  z.string().max(200).optional(),
}).refine(
  (data) => (data.actualHours * 60 + data.actualMinutes) > 0,
  { message: 'Actual effort is required to close a bug.', path: ['actualHours'] },
);

export const updateBugSchema = updateTaskSchema.extend({
  severity:         z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  stepsToReproduce: z.array(z.string()).optional(),
  expectedBehavior: z.string().max(1000).optional(),
  actualBehavior:   z.string().max(1000).optional(),
  environment:      bugEnvironmentSchema.optional(),
  affectedVersion:  z.string().max(50).optional(),
  fixedInVersion:   z.string().max(50).optional(),
  isBugVerified:    z.boolean().optional(),
});

export type BugEnvironmentInput = z.infer<typeof bugEnvironmentSchema>;
export type CreateBugInput      = z.infer<typeof createBugSchema>;
export type VerifiedBugInput    = z.infer<typeof verifiedBugSchema>;
export type CloseBugInput       = z.infer<typeof closeBugSchema>;
export type UpdateBugInput      = z.infer<typeof updateBugSchema>;
