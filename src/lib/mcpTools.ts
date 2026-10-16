import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Wraps the exact same REST endpoints the browser uses, so every business
// rule (transition order, blocked-task checks, dependency-cycle rejection,
// notifications) is enforced identically — this never touches Prisma
// directly. Mirrors mcp-server/src/index.ts (the local stdio server); kept
// as a separate copy since that package has its own dependency tree, but
// the tool set is meant to stay identical between the two.

interface DeskContext {
  baseUrl: string;
  token:   string;
}

class DeskApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolErr(e: unknown) {
  const message = e instanceof DeskApiError ? `[HTTP ${e.status}] ${e.message}` : String(e);
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

interface TaskRef { id: string; humanId: string; title: string; status: string; dependsOn: string[]; [key: string]: unknown }

// Announcements and wiki pages store rich text as Tiptap JSON — this turns
// plain text into a minimal doc (blank lines become paragraph breaks) so an
// LLM caller can just pass a string.
function toTiptapDoc(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) paragraphs.push('');
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type:    'paragraph',
      content: p ? [{ type: 'text', text: p }] : [],
    })),
  };
}

// The monthly timeline is a full day-by-day grid per person - far too big to hand an LLM as-is.
// Keep each person's summary and only the days that matter (leave, early/late notices, absences).
interface TimelineCellLite {
  status: string | null;
  leave: { type: string; status: string; reason: string | null } | null;
  notices: { id: string; type: string; expectedTime: string; reason: string }[];
}
interface TimelineLite {
  data: {
    month: string; todayKey: string; days: { dateKey: string }[];
    members: { userId: string; name: string; designation: string | null; attendanceMode: string; summary: unknown; cells: TimelineCellLite[] }[];
  };
}
function compactTimeline(res: TimelineLite, userId?: string) {
  const { month, todayKey, days, members } = res.data;
  return {
    month, today: todayKey,
    members: members.filter((m) => !userId || m.userId === userId).map((m) => ({
      userId: m.userId, name: m.name, designation: m.designation, attendanceMode: m.attendanceMode, summary: m.summary,
      notableDays: m.cells.flatMap((c, i) =>
        c.leave || c.notices.length > 0 || c.status === 'ABSENT'
          ? [{ date: days[i].dateKey, status: c.status, leave: c.leave, notices: c.notices }]
          : []),
    })),
  };
}

export function registerMcpTools(server: McpServer, ctx: DeskContext) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${ctx.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${ctx.token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = typeof json.error === 'string' ? json.error : JSON.stringify(json.error ?? res.statusText);
      throw new DeskApiError(res.status, message);
    }
    return json as T;
  }

  const desk = {
    get:   <T>(path: string) => request<T>('GET', path),
    post:  <T>(path: string, body: unknown) => request<T>('POST', path, body),
    patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
    delete: <T>(path: string) => request<T>('DELETE', path),
    put:    <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  };

  // ── Read tools ────────────────────────────────────────────────────────────

  server.tool(
    'list_tasks',
    'List tasks/bugs on the board, with optional filters. Use this to see what work exists before creating or updating anything.',
    {
      status:       z.string().optional().describe('Comma-separated statuses: TO_DO, IN_PROGRESS, INTERNAL_REVIEW, CLIENT_REVIEW, DONE, CLOSED'),
      priority:     z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
      assigneeId:   z.string().optional().describe('User id, or "unassigned"'),
      myTasks:      z.boolean().optional().describe('Only tasks assigned to the token owner'),
      itemType:     z.enum(['TASK', 'BUG']).optional(),
      clientId:     z.string().optional(),
      projectId:    z.string().optional(),
      team:         z.enum(['MARKETING', 'DESIGN', 'DEV']).optional(),
      blocked:      z.boolean().optional().describe('Only tasks currently blocked by an unfinished dependency'),
      search:       z.string().optional().describe('Free-text search on title'),
    },
    async (args) => { try { return ok(await desk.get(`/api/tasks${qs(args)}`)); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'get_task',
    'Get full details of a single task or bug, including dependencies, comments, and history.',
    { id: z.string().describe('Task id (from list_tasks), not the human-readable code like GW-001') },
    async ({ id }) => { try { return ok(await desk.get(`/api/tasks/${id}`)); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'list_clients',
    'List clients in the agency work-management hierarchy (Client -> Project -> Task).',
    {},
    async () => { try { return ok(await desk.get('/api/clients')); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'list_projects',
    'List projects, optionally filtered to one client. A project is required when creating a task (use its id as projectId) — call this after list_clients if you don\'t have one.',
    { clientId: z.string().optional() },
    async ({ clientId }) => { try { return ok(await desk.get(`/api/projects${qs({ clientId })}`)); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'list_employees',
    'List employees, for resolving names to ids when assigning tasks.',
    {},
    async () => { try { return ok(await desk.get('/api/employees/list')); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'list_announcements',
    'List company announcements from the Workspace feed, pinned first then most recent.',
    { page: z.number().min(1).optional(), limit: z.number().min(1).max(20).optional() },
    async ({ page, limit }) => { try { return ok(await desk.get(`/api/announcements${qs({ page, limit })}`)); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'list_wiki_articles',
    'List Company Wiki articles, grouped by category.',
    {},
    async () => { try { return ok(await desk.get('/api/wiki')); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'list_polls',
    'List polls (active and closed), with current vote counts and whether the token owner has voted.',
    {},
    async () => { try { return ok(await desk.get('/api/polls')); } catch (e) { return toolErr(e); } },
  );

  // ── Write tools ───────────────────────────────────────────────────────────

  server.tool(
    'create_task',
    'Create a new task (or bug). Requires a clientId — call list_clients first if you don\'t have one. '
    + 'projectId is optional — call list_projects to scope work to a specific project, or omit it for a client-level task. '
    + 'For bugs (itemType=BUG), severity, stepsToReproduce, expectedBehavior, and actualBehavior are also required.',
    {
      title:               z.string(),
      clientId:            z.string(),
      projectId:           z.string().optional(),
      description:         z.string().optional(),
      priority:            z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
      assigneeId:          z.string().optional(),
      dueDate:             z.string().optional().describe('ISO date string, e.g. 2026-10-01'),
      estimatedHours:      z.number().min(0).default(0),
      estimatedMinutes:    z.number().min(0).max(59).default(0),
      itemType:            z.enum(['TASK', 'BUG']).optional().default('TASK'),
      dependsOn:           z.array(z.string()).optional().describe('Task ids this task depends on'),
      team:                z.enum(['MARKETING', 'DESIGN', 'DEV']).optional(),
      phase:               z.enum(['RESEARCH', 'FORECAST', 'BUILD', 'LAUNCH', 'OPTIMIZE']).optional(),
      isGate:              z.boolean().optional(),
      isPrivate:           z.boolean().optional().describe('If true, only the assignee, reporter, and Admins can see this task'),
      assignMode:          z.enum(['SINGLE', 'TOGETHER', 'OFFER']).optional().describe('SINGLE (default): one assignee. TOGETHER: several people each own a part and the task only moves to review when all are done. OFFER: offered to several people, the first to accept takes it.'),
      people:              z.array(z.object({ userId: z.string(), role: z.string().optional().describe('e.g. Designer, Developer, Marketer (TOGETHER only)') })).optional().describe('2-8 people for TOGETHER or OFFER (ignore assigneeId then)'),
      needsClientApproval: z.boolean().optional(),
      severity:            z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
      stepsToReproduce:    z.array(z.string()).optional(),
      expectedBehavior:    z.string().optional(),
      actualBehavior:      z.string().optional(),
    },
    async (args) => { try { return ok(await desk.post('/api/tasks', args)); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'update_task_status',
    'Move a task through the pipeline: TO_DO -> IN_PROGRESS -> INTERNAL_REVIEW -> CLIENT_REVIEW -> DONE -> CLOSED. '
    + 'Non-admin tokens can only move one step forward at a time, or any number of steps backward. '
    + 'A task blocked by an unfinished dependency cannot move to IN_PROGRESS. '
    + 'Moving to CLOSED requires actualMinutes (total minutes actually spent).',
    {
      id:             z.string(),
      status:         z.enum(['TO_DO', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'DONE', 'CLOSED']),
      actualMinutes:  z.number().optional().describe('Required when status is CLOSED'),
      completionNote: z.string().optional(),
    },
    async ({ id, ...body }) => { try { return ok(await desk.patch(`/api/tasks/${id}`, body)); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'assign_task',
    'Assign a task to an employee, or pass null to unassign.',
    { id: z.string(), assigneeId: z.string().nullable() },
    async ({ id, assigneeId }) => { try { return ok(await desk.patch(`/api/tasks/${id}`, { assigneeId })); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'update_task',
    'Update arbitrary fields on a task: title, description, priority, dueDate, client/project/team/phase, gate flag, etc. '
    + 'For status changes use update_task_status instead (it enforces the pipeline rules).',
    {
      id:                  z.string(),
      title:               z.string().optional(),
      description:         z.string().optional(),
      priority:            z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
      dueDate:             z.string().nullable().optional(),
      clientId:            z.string().optional(),
      projectId:           z.string().nullable().optional().describe('Pass null to clear the project — a task can have a Client without a Project'),
      team:                z.enum(['MARKETING', 'DESIGN', 'DEV']).nullable().optional(),
      phase:               z.enum(['RESEARCH', 'FORECAST', 'BUILD', 'LAUNCH', 'OPTIMIZE']).nullable().optional(),
      isGate:              z.boolean().optional(),
      isPrivate:           z.boolean().optional(),
      needsClientApproval: z.boolean().optional(),
    },
    async ({ id, ...body }) => { try { return ok(await desk.patch(`/api/tasks/${id}`, body)); } catch (e) { return toolErr(e); } },
  );

  server.tool(
    'add_task_dependency',
    'Make one task depend on another (the task cannot move to IN_PROGRESS until its dependency reaches Done/Closed). Rejected if it would create a cycle.',
    { taskId: z.string(), dependsOnTaskId: z.string() },
    async ({ taskId, dependsOnTaskId }) => {
      try {
        const { data: task } = await desk.get<{ data: TaskRef }>(`/api/tasks/${taskId}`);
        const next = [...new Set([...(task.dependsOn ?? []), dependsOnTaskId])];
        return ok(await desk.patch(`/api/tasks/${taskId}`, { dependsOn: next }));
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'remove_task_dependency',
    'Remove a dependency from a task.',
    { taskId: z.string(), dependsOnTaskId: z.string() },
    async ({ taskId, dependsOnTaskId }) => {
      try {
        const { data: task } = await desk.get<{ data: TaskRef }>(`/api/tasks/${taskId}`);
        const next = (task.dependsOn ?? []).filter((id) => id !== dependsOnTaskId);
        return ok(await desk.patch(`/api/tasks/${taskId}`, { dependsOn: next }));
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'add_comment',
    'Post a plain-text comment on a task.',
    { taskId: z.string(), text: z.string() },
    async ({ taskId, text }) => {
      try {
        const body = {
          body:             { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
          bodyText:         text,
          mentionedUserIds: [],
        };
        return ok(await desk.post(`/api/tasks/${taskId}/comments`, body));
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'create_announcement',
    'Post a company-wide announcement to the Workspace feed (Admin only). Notifies every employee.',
    {
      title:    z.string(),
      body:     z.string().describe('Plain text — a blank line between lines starts a new paragraph'),
      isPinned: z.boolean().optional().describe('Pin to the top of the feed'),
    },
    async ({ title, body, isPinned }) => {
      try {
        return ok(await desk.post('/api/announcements', { title, body: toTiptapDoc(body), isPinned }));
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'create_wiki_article',
    'Create a new Company Wiki article (Admin only). Notifies every employee.',
    {
      title:    z.string(),
      content:  z.string().describe('Plain text — a blank line between lines starts a new paragraph'),
      category: z.string().optional().describe('Defaults to "General"'),
    },
    async ({ title, content, category }) => {
      try {
        return ok(await desk.post('/api/wiki', { title, content: toTiptapDoc(content), category }));
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'update_wiki_article',
    'Edit an existing Company Wiki article\'s title, content, and/or category (Admin only). Notifies every employee.',
    {
      id:       z.string().describe('Article id, from list_wiki_articles'),
      title:    z.string().optional(),
      content:  z.string().optional().describe('Plain text — a blank line between lines starts a new paragraph'),
      category: z.string().optional(),
    },
    async ({ id, content, ...rest }) => {
      try {
        const body = { ...rest, ...(content !== undefined ? { content: toTiptapDoc(content) } : {}) };
        return ok(await desk.patch(`/api/wiki/${id}`, body));
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'create_poll',
    'Create a team poll (Admin only). Notifies every employee.',
    {
      question:  z.string(),
      options:   z.array(z.string()).min(2).max(8),
      expiresAt: z.string().optional().describe('ISO datetime the poll closes at, e.g. 2026-10-15T00:00:00Z'),
    },
    async ({ question, options, expiresAt }) => {
      try {
        return ok(await desk.post('/api/polls', { question, options, expiresAt }));
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'vote_poll',
    'Cast the token owner\'s vote on a poll (one vote per person, cannot be changed after).',
    { pollId: z.string(), optionIndex: z.number().int().min(0).describe('0-based index into the poll\'s options array') },
    async ({ pollId, optionIndex }) => {
      try { return ok(await desk.post(`/api/polls/${pollId}/vote`, { optionIndex })); }
      catch (e) { return toolErr(e); }
    },
  );

  // -- Attendance timeline, heads-ups and work-from-anywhere --

  server.tool(
    'get_team_timeline',
    'Monthly attendance timeline for the whole team (Admin only): per-person summary (full days, leave, absences, average hours, early-leave and late-arrival notices) plus the notable days - planned leave, heads-up notices and unplanned absences. People set to "ANYWHERE" (e.g. founders) are never counted absent.',
    {
      month:  z.string().regex(/^\d{4}-\d{2}$/).optional().describe('yyyy-MM, defaults to the current month'),
      userId: z.string().optional().describe('Only this person (id from list_employees)'),
    },
    async ({ month, userId }) => {
      try { return ok(compactTimeline(await desk.get<TimelineLite>(`/api/attendance/timeline${qs({ month })}`), userId)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'get_heads_up',
    'What is coming up: planned leave (approved and pending) plus "leaving early" / "coming in late" notices for the next N days. Admins see the whole team, everyone else only their own. Each notice item has an id usable with cancel_attendance_notice.',
    { days: z.number().int().min(1).max(60).optional().describe('How many days ahead, default 14') },
    async ({ days }) => {
      try { return ok(await desk.get(`/api/attendance/heads-up${qs({ days })}`)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'give_attendance_notice',
    'Give the admins a heads-up, on behalf of the token owner, that they will leave early or arrive late on a given day. It appears on the admin Team Timeline and notifies admins. Planned leave is separate - use the leave flow for that.',
    {
      date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('yyyy-MM-dd, today or up to 90 days ahead, not a Sunday'),
      type:         z.enum(['LEAVING_EARLY', 'LATE_ARRIVAL']),
      expectedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).describe('24h IST time: when they will leave, or arrive by, e.g. 16:00'),
      reason:       z.string().min(3).max(300),
    },
    async (args) => {
      try { return ok(await desk.post('/api/attendance/notices', args)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'cancel_attendance_notice',
    'Cancel a leaving-early / late-arrival heads-up (owners can cancel their own, Admins can cancel any). Get the id from get_heads_up.',
    { id: z.string() },
    async ({ id }) => {
      try { return ok(await desk.delete(`/api/attendance/notices/${id}`)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'set_attendance_mode',
    'Set whether someone must clock in (Admin only). ANYWHERE = works from anywhere (typically founders / co-founders): no clock-in needed and never shown as absent. CLOCK_IN = the normal mode.',
    {
      userId: z.string().describe('Employee id, from list_employees'),
      mode:   z.enum(['CLOCK_IN', 'ANYWHERE']),
    },
    async ({ userId, mode }) => {
      try { return ok(await desk.patch(`/api/employees/${userId}`, { attendanceMode: mode })); }
      catch (e) { return toolErr(e); }
    },
  );

  // -- Company holiday calendar --

  server.tool(
    'list_holidays',
    'List the company holiday calendar (mandatory leave days like Diwali, Pongal, New Year) for a year, or just the next few upcoming ones. Everyone can read it.',
    {
      year:     z.number().int().min(2020).max(2100).optional().describe('Calendar year, defaults to the current year'),
      upcoming: z.number().int().min(1).max(20).optional().describe('Instead of a year: the next N holidays from today'),
    },
    async ({ year, upcoming }) => {
      try { return ok(await desk.get(`/api/holidays${qs({ year, upcoming })}`)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'set_holidays',
    'Add or update many company holidays at once (Admin only). mode "merge" adds new dates and updates matching ones, leaving others alone. mode "replaceYear" makes that year match the list exactly (holidays in that year not listed are removed) - confirm with the user before using it. Notifies every employee.',
    {
      rows: z.array(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('yyyy-MM-dd'),
        name: z.string().min(2).max(80),
        note: z.string().max(200).optional(),
      })).min(1).max(200),
      mode: z.enum(['merge', 'replaceYear']).optional().describe('Default merge'),
      year: z.number().int().min(2020).max(2100).optional().describe('Required for replaceYear; every date must fall in it'),
    },
    async (args) => {
      try { return ok(await desk.post('/api/holidays/bulk', args)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'update_holiday',
    'Change one holiday\'s date, name or note (Admin only). Notifies every employee when the date or name changes. Get the id from list_holidays.',
    {
      id:   z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      name: z.string().min(2).max(80).optional(),
      note: z.string().max(200).optional(),
    },
    async ({ id, ...rest }) => {
      try { return ok(await desk.patch(`/api/holidays/${id}`, rest)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'delete_holiday',
    'Remove one holiday from the company calendar (Admin only). Notifies every employee. Get the id from list_holidays.',
    { id: z.string() },
    async ({ id }) => {
      try { return ok(await desk.delete(`/api/holidays/${id}`)); }
      catch (e) { return toolErr(e); }
    },
  );

  // -- Shared work: together / anyone --

  server.tool(
    'accept_task',
    'Accept a task that was OFFERED to a group (assignMode OFFER). The first person to accept becomes the single assignee and everyone else is released. Fails with 409 if someone already took it.',
    { id: z.string().describe('Task id') },
    async ({ id }) => {
      try { return ok(await desk.post(`/api/tasks/${id}/accept`, {})); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'mark_task_part',
    'On a TOGETHER task, mark the token owner\'s own part as done (or reopen it). When the last part is done the task moves to Internal Review automatically; reopening a part sends it back to In Progress. Admins/creators can pass userId to tick someone else\'s part.',
    {
      id:     z.string().describe('Task id'),
      done:   z.boolean(),
      userId: z.string().optional(),
    },
    async ({ id, ...body }) => {
      try { return ok(await desk.post(`/api/tasks/${id}/part`, body)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'set_task_people',
    'Change who is on a task, or how (Admin or the task\'s creator only). mode SINGLE = one owner (pass assigneeId); TOGETHER = people with roles each own a part; OFFER = offered to a group, first to accept takes it (only before the task has started). Presets: a web page needs a Designer + Developer; a live ad deployment needs a Marketer + Designer.',
    {
      id:         z.string().describe('Task id'),
      mode:       z.enum(['SINGLE', 'TOGETHER', 'OFFER']),
      people:     z.array(z.object({ userId: z.string(), role: z.string().optional() })).optional(),
      assigneeId: z.string().nullable().optional().describe('SINGLE only'),
    },
    async ({ id, people, ...rest }) => {
      try { return ok(await desk.put(`/api/tasks/${id}/people`, { ...rest, people: people ?? [] })); }
      catch (e) { return toolErr(e); }
    },
  );

  // -- Meta Ads (Admin only) --

  server.tool(
    'list_meta_accounts',
    'List the Meta ad accounts the portal knows about (Admin only): which are being tracked, which client each is linked to, currency, and when it last synced. Use the id from here with get_meta_ads_summary, map_meta_account and sync_meta_account.',
    {},
    async () => {
      try { return ok(await desk.get('/api/meta/accounts')); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'get_meta_ads_summary',
    'Meta Ads performance for a date range (Admin only): spend, results and cost per result with the change versus the previous period, reach/clicks/CTR/CPC/CPM, ROAS when there is purchase revenue, every result type including custom conversions, and the top campaigns. Spend is never added across currencies - pass currency to pick one. Narrow with clientId or accountId (portal ids).',
    {
      from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('yyyy-MM-dd, default 30 days ago'),
      to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('yyyy-MM-dd, default today'),
      clientId:  z.string().optional().describe('Portal client id (from list_clients)'),
      accountId: z.string().optional().describe('Portal Meta account id (from list_meta_accounts)'),
      currency:  z.string().optional().describe('e.g. INR, USD'),
    },
    async (args) => {
      try {
        const q = qs(args);
        const overview = await desk.get<{ data: { currency: string | null } }>(`/api/meta/overview${q}`);
        const campaigns = await desk.get(`/api/meta/objects${qs({ ...args, currency: args.currency ?? overview.data.currency ?? undefined, level: 'CAMPAIGN' })}`);
        return ok({ overview: overview.data, campaigns });
      } catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'map_meta_account',
    'Change how a Meta ad account is tracked (Admin only): link it to a portal client (always a deliberate choice, never matched by name), switch tracking on or off, or pick its headline result (e.g. leads, purchases, messages, link_clicks, or custom:<id>). Pass clientId null to unlink.',
    {
      id:           z.string().describe('Portal Meta account id (from list_meta_accounts)'),
      clientId:     z.string().nullable().optional(),
      isEnabled:    z.boolean().optional(),
      resultAction: z.string().nullable().optional(),
    },
    async ({ id, ...body }) => {
      try { return ok(await desk.patch(`/api/meta/accounts/${id}`, body)); }
      catch (e) { return toolErr(e); }
    },
  );

  server.tool(
    'sync_meta_account',
    'Pull fresh Meta data for one tracked account right now (Admin only), for up to 31 days at a time (default: the last 7). The portal also does this automatically every morning.',
    {
      accountId: z.string().describe('Portal Meta account id'),
      since:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      until:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
    async (args) => {
      try { return ok(await desk.post('/api/meta/sync', args)); }
      catch (e) { return toolErr(e); }
    },
  );
}
