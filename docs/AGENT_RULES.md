# AGENT RULES — Employee Self-Service Portal
> **Location:** Store this file as `docs/AGENT_RULES.md` in the root of your project.
> **Instruction to agent:** At the start of EVERY task, read `docs/AGENT_RULES.md` fully before writing a single line of code. Never skip this step.

---

## 0. AGENT PRIME DIRECTIVE

Before starting any task:
1. Read this file completely.
2. Identify which module the task belongs to (Attendance / Tasks / HR / Communication / Auth / Shared).
3. Check the folder structure section and place new files in the correct location.
4. Follow the code standards, UI rules, and naming conventions exactly as written.
5. Never introduce a new library without checking the approved stack list first.

---

## 1. PROJECT OVERVIEW

**Product:** Internal Employee Self-Service Portal  
**Company size:** ~20 employees (startup)  
**Purpose:** Attendance management (clock-in/out, leaves), Task boards (Kanban), HR & People, Communication, Admin tools  
**Design inspiration:** Linear + Notion + GreytHR  
**Target:** Desktop-first (1440px), responsive down to mobile (375px)

---

## 2. TECH STACK

### Frontend
| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | SSR, file-based routing, API routes in one repo |
| Language | **TypeScript (strict mode)** | Type safety across the full codebase |
| Styling | **Tailwind CSS v3** | Utility-first, consistent design tokens |
| UI Components | **shadcn/ui** | Headless, accessible, matches design system |
| State management | **Zustand** | Lightweight global state (auth, notifications, sidebar) |
| Server state | **TanStack Query (React Query v5)** | All API data fetching, caching, mutations |
| Forms | **React Hook Form + Zod** | Validation-first forms with type-safe schemas |
| Date handling | **date-fns** | Lightweight, tree-shakeable (no moment.js) |
| Drag & Drop | **@dnd-kit/core** | Kanban board drag-and-drop |
| Rich text | **Tiptap** | Task descriptions, announcements editor |
| Charts | **Recharts** | Attendance trends, task analytics |
| Icons | **Lucide React** | Consistent icon set, matches shadcn/ui |
| Animations | **Framer Motion** | Page transitions, micro-interactions |
| Notifications | **Sonner** | Toast notifications (top-right, auto-dismiss) |

### Backend
| Layer | Choice |
|---|---|
| Runtime | **Node.js 20 LTS** |
| Framework | **Next.js API Routes** (same repo, `/app/api/`) |
| ORM | **Prisma** |
| Database | **PostgreSQL** (Docker Containerized) |
| Auth | **NextAuth.js v5** (Google SSO + credentials fallback) |
| File storage | **Supabase Storage** (documents, avatars) |
| Email | **Resend** (leave notifications, approvals) |
| Real-time | **Supabase Realtime** (attendance presence, notifications) |
| Validation | **Zod** (shared schemas between frontend and backend) |

### DevOps & Tooling
| Tool | Purpose |
|---|---|
| **pnpm** | Package manager (faster than npm) |
| **ESLint + Prettier** | Code quality and formatting |
| **Husky + lint-staged** | Pre-commit hooks |
| **Vercel** | Hosting and CI/CD |
| **Docker** | PostgreSQL database container isolation |
| **Supabase** | Cloud Storage + Realtime features |

---

## 3. FOLDER STRUCTURE

```
/
├── docs/
│   └── AGENT_RULES.md              ← YOU ARE HERE. Read this first always.
│
├── prisma/
│   ├── schema.prisma               ← Database schema
│   └── migrations/                 ← Auto-generated migrations
│
├── public/
│   ├── fonts/                      ← Self-hosted Inter font
│   └── images/                     ← Static images, empty state illustrations
│
├── src/
│   ├── app/                        ← Next.js App Router
│   │   ├── (auth)/                 ← Route group: unauthenticated pages
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (portal)/               ← Route group: authenticated app
│   │   │   ├── layout.tsx          ← Root layout: sidebar + header + content
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── attendance/
│   │   │   │   ├── page.tsx        ← My attendance (calendar + log)
│   │   │   │   └── leaves/
│   │   │   │       └── page.tsx    ← Leave management + apply
│   │   │   ├── tasks/
│   │   │   │   ├── page.tsx        ← Kanban board
│   │   │   │   └── [taskId]/
│   │   │   │       └── page.tsx    ← Task detail slide-over
│   │   │   ├── hr/
│   │   │   │   ├── page.tsx        ← Employee directory
│   │   │   │   └── [employeeId]/
│   │   │   │       └── page.tsx    ← Employee profile
│   │   │   ├── communication/
│   │   │   │   └── page.tsx        ← Announcements + wiki
│   │   │   ├── approvals/          ← Manager/Admin only
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── notifications/
│   │   │       └── page.tsx
│   │   │
│   │   ├── api/                    ← Backend API routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── attendance/
│   │   │   │   ├── route.ts        ← GET list, POST clock-in
│   │   │   │   ├── clock-out/
│   │   │   │   │   └── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── leaves/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── tasks/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── employees/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── announcements/
│   │   │   │   └── route.ts
│   │   │   └── notifications/
│   │   │       └── route.ts
│   │   │
│   │   ├── globals.css             ← Tailwind base + CSS variables
│   │   └── layout.tsx              ← Root HTML layout (fonts, providers)
│   │
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui primitives (DO NOT EDIT)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── sheet.tsx           ← Slide-over panel
│   │   │   ├── tabs.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/                 ← App shell components
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SidebarItem.tsx
│   │   │   ├── TopHeader.tsx
│   │   │   └── PageHeader.tsx
│   │   │
│   │   ├── attendance/             ← Attendance-specific components
│   │   │   ├── ClockInCard.tsx
│   │   │   ├── AttendanceCalendar.tsx
│   │   │   ├── AttendanceLogTable.tsx
│   │   │   ├── LeaveBalanceCards.tsx
│   │   │   ├── LeaveApplyForm.tsx
│   │   │   ├── LeaveTable.tsx
│   │   │   └── TeamLeaveCalendar.tsx
│   │   │
│   │   ├── tasks/                  ← Task board components
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskDetailPanel.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   ├── PriorityBadge.tsx
│   │   │   └── SubTaskList.tsx
│   │   │
│   │   ├── hr/                     ← HR components
│   │   │   ├── EmployeeCard.tsx
│   │   │   ├── EmployeeTable.tsx
│   │   │   ├── EmployeeProfile.tsx
│   │   │   ├── DocumentVault.tsx
│   │   │   └── OrgChart.tsx
│   │   │
│   │   ├── communication/          ← Communication components
│   │   │   ├── AnnouncementCard.tsx
│   │   │   ├── AnnouncementEditor.tsx
│   │   │   ├── PollCard.tsx
│   │   │   └── BirthdayWidget.tsx
│   │   │
│   │   ├── dashboard/              ← Dashboard-specific widgets
│   │   │   ├── StatCard.tsx
│   │   │   ├── WeeklyAttendanceBar.tsx
│   │   │   ├── MyTasksList.tsx
│   │   │   └── TeamPresenceList.tsx
│   │   │
│   │   └── shared/                 ← Reusable across all modules
│   │       ├── DataTable.tsx       ← Generic sortable/filterable table
│   │       ├── EmptyState.tsx      ← Empty state with illustration
│   │       ├── SkeletonCard.tsx    ← Loading skeleton
│   │       ├── SkeletonTable.tsx
│   │       ├── StatusBadge.tsx     ← Unified status badge
│   │       ├── UserAvatar.tsx      ← Initials or photo avatar
│   │       ├── ConfirmDialog.tsx   ← Reusable confirm modal
│   │       ├── FileUpload.tsx      ← Drag-and-drop upload
│   │       └── PageLoader.tsx
│   │
│   ├── hooks/                      ← Custom React hooks
│   │   ├── useAuth.ts              ← Current session + user
│   │   ├── useAttendance.ts        ← Clock-in/out mutations
│   │   ├── useLeaves.ts
│   │   ├── useTasks.ts
│   │   ├── useEmployees.ts
│   │   ├── useNotifications.ts
│   │   └── useDebounce.ts
│   │
│   ├── lib/                        ← Utilities and config
│   │   ├── auth.ts                 ← NextAuth config
│   │   ├── prisma.ts               ← Prisma client singleton
│   │   ├── supabase.ts             ← Supabase client
│   │   ├── resend.ts               ← Email client
│   │   ├── utils.ts                ← cn(), formatDate(), etc.
│   │   ├── constants.ts            ← App-wide constants
│   │   └── validations/            ← Zod schemas (shared FE + BE)
│   │       ├── attendance.ts
│   │       ├── leave.ts
│   │       ├── task.ts
│   │       └── employee.ts
│   │
│   ├── store/                      ← Zustand global stores
│   │   ├── useUIStore.ts           ← Sidebar open/close, theme
│   │   ├── useAuthStore.ts         ← Current user, role
│   │   └── useNotificationStore.ts ← Unread count, notification list
│   │
│   └── types/                      ← TypeScript type definitions
│       ├── index.ts                ← Re-exports all types
│       ├── auth.ts
│       ├── attendance.ts
│       ├── task.ts
│       ├── employee.ts
│       └── api.ts                  ← API response wrapper types
│
├── .env.local                      ← Local env vars (never commit)
├── .env.example                    ← Template for env vars (commit this)
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. DESIGN SYSTEM — AGENT MUST FOLLOW EXACTLY

### 4.1 Color Tokens (Tailwind config)

The `tailwind.config.ts` must include these custom tokens:

```ts
colors: {
  brand: {
    DEFAULT: '#4F46E5',   // indigo — primary actions
    hover:   '#4338CA',
    light:   '#EEF2FF',
    muted:   '#818CF8',
  },
  sidebar: {
    bg:      '#0F172A',   // dark slate
    text:    '#CBD5E1',
    active:  '#4F46E5',
    hover:   '#1E293B',
  },
  status: {
    present:  '#16A34A',
    absent:   '#DC2626',
    wfh:      '#D97706',
    leave:    '#7C3AED',
    holiday:  '#0891B2',
  },
  priority: {
    p0: '#DC2626',   // critical
    p1: '#D97706',   // high
    p2: '#2563EB',   // medium
    p3: '#6B7280',   // low
  }
}
```

### 4.2 Typography Rules

- Font: **Inter** (self-hosted via `next/font/local`)
- Page titles: `text-2xl font-semibold text-gray-900`
- Section labels: `text-xs font-medium text-gray-500 uppercase tracking-wider`
- Body: `text-sm text-gray-700`
- Muted/secondary: `text-sm text-gray-400`
- **Never use font-bold (700).** Maximum weight is `font-semibold (600)`.
- **Never use text-xs below 11px equivalent.**

### 4.3 Spacing Rules

- Page padding: `p-6` or `px-8 py-6`
- Card padding: `p-4` or `p-5`
- Gap between cards: `gap-4`
- Gap between form fields: `space-y-4`
- Section margin: `mt-8` between major sections

### 4.4 Component Patterns

**Cards:**
```tsx
<div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 transition-colors">
```

**Stat/metric cards:**
```tsx
<div className="bg-gray-50 rounded-lg p-4">
  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Label</p>
  <p className="text-2xl font-semibold text-gray-900 mt-1">Value</p>
</div>
```

**Primary button:**
```tsx
<Button className="bg-brand text-white hover:bg-brand-hover h-9 px-4 rounded-lg text-sm font-medium">
```

**Status badges — always use StatusBadge component, never inline:**
```tsx
<StatusBadge status="approved" />   // green
<StatusBadge status="pending" />    // amber
<StatusBadge status="rejected" />   // red
<StatusBadge status="active" />     // blue
<StatusBadge status="closed" />     // gray
```

**Sidebar:**
- Background: `bg-sidebar-bg` (dark slate, #0F172A)
- Width: `w-60` fixed, `w-16` when collapsed
- Never change sidebar background color.
- Active nav item: left border-brand + bg-sidebar-hover + text white

### 4.5 Responsive Rules

| Breakpoint | Sidebar | Layout |
|---|---|---|
| `xl` (1280px+) | Full 240px, labels visible | Multi-column |
| `lg` (1024px) | Icon-only 64px | Slightly compressed |
| `md` (768px) | Hidden, hamburger menu | Single column |
| `sm` (375px) | Bottom tab bar replaces sidebar | Stacked |

Always use `hidden lg:block` pattern. Never use arbitrary breakpoints.

### 4.6 Loading States

**Rule: NEVER show a blank page or spinner for data-fetching.**  
Always use skeleton screens:
- Use `<SkeletonCard />` for card grids
- Use `<SkeletonTable rows={5} />` for tables
- Use `<SkeletonKanban />` for the task board
- Skeletons must have `animate-pulse` and match the exact shape of real content

### 4.7 Empty States

**Rule: Every list, table, and board MUST have an empty state.**  
Use `<EmptyState />` component with:
```tsx
<EmptyState
  icon={<CalendarOff className="w-10 h-10 text-gray-300" />}
  title="No attendance records"
  description="Your check-ins and check-outs will appear here."
  action={<Button>Clock In Now</Button>}    // optional
/>
```

### 4.8 Toast Notifications

**Rule: Always use Sonner for all feedback. Never use alert().**
```ts
toast.success('Leave applied successfully')
toast.error('Failed to clock in. Try again.')
toast.info('Approval sent to your manager')
```
- Position: `top-right`
- Duration: `4000ms`
- Never stack more than 3 toasts at once

### 4.9 Micro-interaction Rules

- All interactive elements: `transition-colors duration-150`
- Hover on cards: `hover:border-indigo-200`
- Button press: `active:scale-[0.98]`
- Sidebar nav hover: `hover:bg-sidebar-hover`
- Page transitions: Framer Motion `fadeIn` (opacity 0→1, 150ms)
- Clock-in button: pulse ring animation when ready to clock in
- Kanban drag: `rotate-1 shadow-lg scale-105` on drag start

---

## 5. CODE STANDARDS

### 5.1 General Rules

- **TypeScript strict mode** — no `any` allowed. Use `unknown` and narrow.
- All components are **functional components** with named exports.
- **No default exports** except Next.js page files (`page.tsx`, `layout.tsx`).
- **No inline styles** — use Tailwind classes only. Exception: dynamic values via `style={{ width: \`${percent}%\` }}`.
- All API calls go through **custom hooks** using TanStack Query. Never call `fetch()` directly inside a component.
- All forms use **React Hook Form + Zod schema**. Never use uncontrolled inputs.

### 5.2 File Naming

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `TaskCard.tsx` |
| Hooks | camelCase with `use` prefix | `useTasks.ts` |
| Utilities | camelCase | `formatDate.ts` |
| API routes | `route.ts` | `/api/tasks/route.ts` |
| Pages | `page.tsx` | `/tasks/page.tsx` |
| Types | camelCase | `task.ts` |
| Zod schemas | camelCase with `Schema` suffix | `taskSchema.ts` |
| Constants | SCREAMING_SNAKE_CASE | `LEAVE_TYPES` |

### 5.3 Component Structure Template

Every component must follow this order:
```tsx
// 1. Imports (external libs → internal → types → styles)
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { useTasks } from '@/hooks/useTasks'
import type { Task } from '@/types'

// 2. Types
interface TaskCardProps {
  task: Task
  onStatusChange: (id: string, status: Task['status']) => void
}

// 3. Component
export function TaskCard({ task, onStatusChange }: TaskCardProps) {
  // 3a. Hooks (state, queries, etc.)
  const [isOpen, setIsOpen] = useState(false)

  // 3b. Derived values / handlers
  const isOverdue = new Date(task.dueDate) < new Date()

  // 3c. JSX
  return (
    <div className="...">
      {/* content */}
    </div>
  )
}
```

### 5.4 API Route Template

```ts
// /app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { taskSchema } from '@/lib/validations/task'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const tasks = await prisma.task.findMany({ where: { ... } })
    return NextResponse.json({ data: tasks })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = taskSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const task = await prisma.task.create({ data: parsed.data })
    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 5.5 Custom Hook Template

```ts
// /hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Task, CreateTaskInput } from '@/types'

export function useTasks(projectId?: string) {
  const queryClient = useQueryClient()

  const tasks = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?projectId=${projectId}`)
      if (!res.ok) throw new Error('Failed to fetch tasks')
      return res.json() as Promise<{ data: Task[] }>
    },
  })

  const createTask = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await fetch('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
      if (!res.ok) throw new Error('Failed to create task')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task created')
    },
    onError: () => toast.error('Failed to create task'),
  })

  return { tasks, createTask }
}
```

---

## 6. ROLE-BASED ACCESS CONTROL (RBAC)

Three roles exist. The agent must enforce these everywhere:

| Role | Capabilities |
|---|---|
| `EMPLOYEE` | View own attendance, apply leave, view/create tasks in assigned projects, view directory, view announcements |
| `MANAGER` | All EMPLOYEE permissions + approve/reject leaves for their team, view team attendance, assign tasks |
| `ADMIN` | All MANAGER permissions + manage all employees, company settings, all leave approvals, create announcements, add/remove projects |

**Rules:**
- Check role via `session.user.role` from NextAuth
- Use a `<RoleGuard role="ADMIN">` wrapper component for protected UI sections
- API routes must also check role server-side — never trust client-only checks
- Admin-only routes: `/approvals`, `/settings/company`, `/hr` (edit mode)

---

## 7. DATA MODELS (Prisma Schema Reference)

```prisma
model User {
  id           String       @id @default(cuid())
  email        String       @unique
  name         String
  role         Role         @default(EMPLOYEE)
  department   String?
  designation  String?
  phone        String?
  avatarUrl    String?
  managerId    String?
  manager      User?        @relation("Reports", fields: [managerId], references: [id])
  reports      User[]       @relation("Reports")
  attendance   Attendance[]
  leaves       Leave[]
  tasks        Task[]       @relation("Assignee")
  createdTasks Task[]       @relation("Reporter")
  createdAt    DateTime     @default(now())
}

model Attendance {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  date      DateTime  @db.Date
  clockIn   DateTime?
  clockOut  DateTime?
  type      AttendanceType @default(OFFICE)
  ipAddress String?
  location  String?
  createdAt DateTime  @default(now())
}

model Leave {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  type        LeaveType
  fromDate    DateTime    @db.Date
  toDate      DateTime    @db.Date
  days        Float
  reason      String
  status      LeaveStatus @default(PENDING)
  approvedBy  String?
  rejectedBy  String?
  remarks     String?
  documentUrl String?
  createdAt   DateTime    @default(now())
}

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(PENDING)
  priority    Priority   @default(P2)
  projectId   String
  project     Project    @relation(fields: [projectId], references: [id])
  assigneeId  String?
  assignee    User?      @relation("Assignee", fields: [assigneeId], references: [id])
  reporterId  String
  reporter    User       @relation("Reporter", fields: [reporterId], references: [id])
  dueDate     DateTime?
  parentId    String?
  parent      Task?      @relation("SubTasks", fields: [parentId], references: [id])
  subTasks    Task[]     @relation("SubTasks")
  comments    Comment[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

enum Role         { EMPLOYEE MANAGER ADMIN }
enum LeaveType    { EARNED CASUAL SICK LOP COMP_OFF MATERNITY PATERNITY }
enum LeaveStatus  { PENDING APPROVED REJECTED CANCELLED }
enum AttendanceType { OFFICE WFH HALF_DAY }
enum TaskStatus   { PENDING IN_PROGRESS IN_REVIEW CLOSED }
enum Priority     { P0 P1 P2 P3 }
```

---

## 8. ENVIRONMENT VARIABLES

Store in `.env.local` (never commit). Reference `.env.example` for template.

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# Email (Resend)
RESEND_API_KEY="..."
EMAIL_FROM="noreply@yourcompany.com"
```

---

## 9. SECURITY RULES

The agent must never violate these:

1. **All API routes must check session** — no public endpoints except auth routes.
2. **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client** — server-side only.
3. **Validate all inputs with Zod** on the server, never trust client data.
4. **Never store passwords in plain text** — NextAuth handles this.
5. **File uploads** — validate MIME type and size (max 5MB) before uploading to Supabase Storage.
6. **Employees can only see their own attendance** — always filter by `userId = session.user.id` unless role is MANAGER or ADMIN.
7. **Managers can only see their direct reports** — filter by `managerId = session.user.id`.
8. **ADMIN role cannot be self-assigned** — role changes require an existing ADMIN to make them.
9. **Audit log every sensitive action** — leave approvals, role changes, employee deletions.

---

## 10. PERFORMANCE RULES

1. **All data tables must be paginated** — default page size 25. Never fetch all rows.
2. **Debounce all search inputs** — 300ms delay using `useDebounce` hook.
3. **TanStack Query cache** — set `staleTime: 1000 * 60 * 5` (5 minutes) for non-realtime data.
4. **Images** — always use `next/image` with proper `width`, `height`, and `priority` on above-fold images.
5. **Lazy load heavy components** — Kanban board, rich text editor, charts via `dynamic(() => import(...), { ssr: false })`.
6. **Database queries** — always use `select` to pick only needed fields. Never `findMany()` without a `where` clause on large tables.
7. **Attendance calendar** — fetch only the current month by default. Load previous months on demand.

---

## 11. MODULE-SPECIFIC AGENT RULES

### Attendance Module
- Clock-in/out timestamps must be stored in **UTC**. Display in user's local timezone using `date-fns/tz`.
- A user can only clock in once per day. Check for existing record before allowing clock-in.
- Clock-out must be after clock-in. Validate on API.
- Leave balance must be re-calculated when a leave is approved or cancelled.
- Half-day: morning = clock-in before noon, clock-out before 2pm. Afternoon = the reverse.
- Attendance calendar: green dot = present, amber = WFH/half-day, red = absent, violet = leave, cyan = holiday.

### Task Board Module

**Status workflows:**

TASK workflow (6 statuses in order):
```
TO_DO → IN_PROGRESS → READY_FOR_QA → IN_TESTING → DONE → CLOSED
```

BUG workflow (6 statuses in order):
```
OPEN → IN_PROGRESS → READY_FOR_QA → IN_TESTING → VERIFIED → CLOSED
Bugs can be REOPENED from VERIFIED or CLOSED → goes back to IN_PROGRESS.
```

**Status source of truth:** `TASK_STATUS_CONFIG` in `src/lib/taskStatusConfig.ts`
- NEVER hardcode status strings, colors, or labels in components.
- Always import from `taskStatusConfig`.
- Always use `<StatusBadge status={item.status} />` — never render status as raw string text or with inline color classes.

**Default item status on creation:**
- TASK → `TO_DO`
- BUG → `OPEN`

**Actual effort rules:**
- Required when moving to `DONE` (tasks) or `VERIFIED` (bugs) → intercept with `DoneTaskModal`.
- NOT required for `CLOSED` (administrative archive step) → intercept with `CloseConfirmDialog`.

**Drag transition rules:**
- Non-admin: can only move one step forward at a time. Can move back freely.
- Admin: can move to any status freely.
- Moving to `DONE`/`VERIFIED`: intercept with `DoneTaskModal` (effort required).
- Moving to `CLOSED`: intercept with `CloseConfirmDialog` (no effort required).
- Moving to `IN_TESTING`: brief 3s claim confirmation toast with Cancel.
- Moving backwards: allowed freely, brief informational toast shown.
- Invalid skip (non-admin): snap card back + error toast.

**Mixed board columns (when All Items selected):**
| Column | Statuses | Header label |
|---|---|---|
| Col 1 | `TO_DO` + `OPEN` | "To Do / Open" |
| Col 2 | `IN_PROGRESS` | "In Progress" |
| Col 3 | `READY_FOR_QA` | "Ready for QA" (amber pulse when items present) |
| Col 4 | `IN_TESTING` | "In Testing" |
| Col 5 | `DONE` + `VERIFIED` | "Done / Verified" |
| Col 6 | `CLOSED` | "Closed" (collapsed by default) |

When filter is "Tasks only": Col 1 = "To Do", Col 5 = "Done".
When filter is "Bugs only": Col 1 = "Open", Col 5 = "Verified".

**Reopen (bugs only):**
- Only for BUG type in `VERIFIED` or `CLOSED` status.
- `POST /api/tasks/:id/reopen` with `{ reason }` (min 5 chars).
- Reopening: status → `IN_PROGRESS`, `reopenCount++`, `actualMinutes` cleared.
- Creates `BUG_REOPENED_BY_QA` history entry with reason in metadata.
- Sends notifications to reporter + assignee.
- Use `ReopenBugDialog` component — never inline the reopen confirm.

**Card visual rules:**
- `READY_FOR_QA` cards: amber left accent border (3px).
- `IN_TESTING` cards: teal left accent border.
- `DONE`/`VERIFIED` cards: green left accent border + subtle green bg tint.
- BugCard: show reopen count badge `↩ Nx` (red) when `reopenCount > 0`.
- Status icon (14px Lucide) shown top-right of each card from `TASK_STATUS_CONFIG[status].icon`.

**Notification types for task workflow:**
- `READY_FOR_QA`: FlaskConical icon, amber bg — sent when item moves to Ready for QA.
- `TESTING_STARTED`: TestTube2 icon, teal bg — sent when item moves to In Testing.
- `TASK_DONE`: CheckCircle2 icon, green bg — sent to reporter when task marked Done.
- `BUG_VERIFIED`: ShieldCheck icon, green bg — sent to reporter when bug Verified.
- `BUG_REOPENED_BY_QA`: RotateCcw icon, red bg — sent to assignee + reporter on reopen.

**History feed actions (ActivityFeed.tsx):**
- `MOVED_TO_READY_FOR_QA`: amber tint row, FlaskConical icon.
- `MOVED_TO_IN_TESTING`: teal icon, shows `metadata.claimedBy`.
- `MOVED_TO_DONE`: green tint row, shows actual effort + variance chip.
- `MOVED_TO_VERIFIED`: green tint row, shows actual effort + variance chip.
- `BUG_REOPENED_BY_QA`: red tint row (prominent), shows reopen count + reason in italic quotes.

**Completed task status for analytics/payroll reporting:**
- "Completed" = status IN `['DONE', 'VERIFIED', 'CLOSED']`.
- For monthly metrics: use `doneAt` field (set when task moves to DONE/VERIFIED).
- Use `COMPLETED_TASK_STATUSES` constant from `src/lib/payroll/index.ts`.
- Never use `status === 'CLOSED'` alone as the completion check.

**Key files for task board:**
- `src/lib/taskStatusConfig.ts` — status config, transition rules, column helpers
- `src/components/tasks/KanbanBoard.tsx` — 6-column mixed board
- `src/components/tasks/DoneTaskModal.tsx` — effort capture on DONE/VERIFIED
- `src/components/tasks/CloseConfirmDialog.tsx` — archive confirmation
- `src/components/tasks/ReopenBugDialog.tsx` — bug reopen with reason
- `src/components/tasks/ActivityFeed.tsx` — unified history + comments feed
- `src/components/shared/StatusBadge.tsx` — always use this for status display

### Task Board — Bug Tracking
- Two item types: TASK and BUG. Both live on the same Kanban board.
- Bug creation button: "+ New Item" → ItemTypeSelector → BugReportForm.
- Bug mandatory fields: severity, stepsToReproduce (min 1), expectedBehavior, actualBehavior, estimatedMinutes.
- Severity auto-sets priority: CRITICAL→P0, HIGH→P1, MEDIUM→P2, LOW→P3 (user can override).
- Board filter: All Items | Tasks only | Bugs only | Severity filter (multi-select).
- BugCard has 4px left accent border colored by severity (not priority): CRITICAL=red-500, HIGH=orange-400, MEDIUM=yellow-400, LOW=blue-400.
- BugCard hover uses `hover:border-red-200` instead of indigo.
- CloseTaskModal for bugs adds optional `fixedInVersion` field.
- Bug verification: after close, any user can mark bug as verified via TaskDetailPanel → POST /api/tasks/:id/verify-bug.
- Severity escalation to CRITICAL or HIGH notifies assignee and all ADMINs via BUG_SEVERITY_CHANGED notification.
- All history actions apply to bugs: status, assignee, priority, effort + bug-specific: BUG_CREATED, SEVERITY_CHANGED, STEPS_UPDATED, ENVIRONMENT_UPDATED, BUG_VERIFIED, FIXED_VERSION_SET, AFFECTED_VERSION_SET.
- Bug notification types: BUG_ASSIGNED (red Bug icon), BUG_VERIFIED (green ShieldCheck icon), BUG_SEVERITY_CHANGED (red Bug icon).
- Dashboard shows Open Bugs stat card for ADMIN with pulsing red dot when critical bugs exist.
- Column headers show bug breakdown: "N bugs · N critical" in mixed mode; critical/high counts in bugs-only mode.
- Never use 'MANAGER' role — only EMPLOYEE and ADMIN exist. ADMIN handles bug assignment escalation.
- Bug-specific Zod schemas: `createBugSchema`, `closeBugSchema`, `updateBugSchema` in `src/lib/validations/task.ts`.
- Bug utilities (severity config, options, badge helpers): `src/lib/bugUtils.ts`.
- New files added for bug tracking:
  - `src/components/tasks/BugCard.tsx` — Kanban card for bugs
  - `src/components/tasks/BugReportForm.tsx` — bug creation modal
  - `src/components/tasks/ItemTypeSelector.tsx` — Task vs Bug picker
  - `src/app/api/tasks/[id]/verify-bug/route.ts` — QA verification endpoint

### HR Module
- Employee profile tabs load lazily — only fetch tab data when that tab is clicked.
- Document vault: file type icon should reflect actual file type (PDF → red icon, image → green, doc → blue).
- Org chart is optional to implement in Phase 2.
- Deactivated employees: show with gray opacity, add "Inactive" badge, exclude from attendance and task assignment.

### Leave Approval Module
- Manager sees only their direct reports' leave requests.
- Admin sees all employees' leave requests.
- When a leave is approved: send email to employee via Resend, deduct from leave balance.
- When rejected: send email with reason. No balance change.
- Leave requests in PENDING status older than 7 days should be highlighted with amber background.

### Attendance Regularization Module
- Regularization window: last 30 days only. Sundays cannot be regularized (they are holidays).
- Max 2 pending requests per employee at any time — enforced at API level.
- Reviewer = the employee's "reports to" person (`managerId` field), not a role-based check.
- ADMIN can always approve/reject any regularization regardless of reviewer decision.
- Reviewer rejection (status=REJECTED) is NOT final — employee can appeal to admin.
- Admin rejection (status=REJECTED_BY_ADMIN) IS final.
- On approval: `applyRegularization()` creates/updates `AttendanceSession` with `isRegularized=true`.
- Regularized days count as PRESENT in payroll — excluded from leave-taken count, no LOP applied.
- All regularization sessions are visually distinguished: amber dashed ring = pending, orange ring = approved.
- Notifications sent to reviewer + all admins on submission; to employee on approve/reject.

---

## 12. GIT COMMIT CONVENTIONS

```
feat(attendance): add WFH toggle to clock-in card
fix(tasks): resolve drag-drop state rollback on API error
style(sidebar): adjust active nav item padding
refactor(leaves): extract leave balance calculation to utility
chore: update Prisma schema for comp-off leave type
```

Format: `type(module): description`
Types: `feat | fix | style | refactor | chore | docs | test`

---

## 13. AGENT CHECKLIST — RUN BEFORE MARKING ANY TASK DONE

Before saying a task is complete, verify:

- [ ] Component is in the correct folder per section 3
- [ ] TypeScript has no errors (`pnpm tsc --noEmit`)
- [ ] No `any` types introduced
- [ ] API route checks session/auth
- [ ] All inputs validated with Zod
- [ ] Loading state (skeleton) implemented
- [ ] Empty state implemented
- [ ] Error state handled (try/catch + toast)
- [ ] Mobile responsive (check at `md` and `sm`)
- [ ] Role-based visibility applied if the feature is role-restricted
- [ ] No inline styles (Tailwind only)
- [ ] No direct `fetch()` in components (use custom hooks)
- [ ] Toast notification on success/error actions

**Task Board specific checks:**
- [ ] No hardcoded `'PENDING'`, `'IN_REVIEW'`, or old status strings anywhere in `src/`
- [ ] Status display uses `<StatusBadge status={item.status} />` — never raw string
- [ ] Status config imported from `taskStatusConfig.ts` — never hardcoded colors/labels
- [ ] New task created with `getDefaultStatus(itemType)` — TASK→TO_DO, BUG→OPEN
- [ ] Drag transitions validated with `isValidTransition()` before committing
- [ ] DONE/VERIFIED moves intercepted with `DoneTaskModal` (effort required)
- [ ] CLOSED moves intercepted with `CloseConfirmDialog` (no effort required)
- [ ] Bug reopen uses `ReopenBugDialog` with reason field (min 5 chars)
- [ ] Completed task analytics use `COMPLETED_TASK_STATUSES` from `src/lib/payroll/index.ts`
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm build` — zero errors

---

## 14. WHERE TO STORE THIS FILE & HOW TO USE IN ANTIGRAVITY

1. **File location:** `docs/AGENT_RULES.md` in the root of your repository.
2. **In Antigravity:** Add this as a **Project Rule** or **System Prompt** in your agent configuration. The exact step:
   - Open your project in Antigravity
   - Go to **Project Settings → Agent Rules** (or "System Instructions")
   - Either paste the full content of this file, OR set the rule: *"Always read `docs/AGENT_RULES.md` at the start of every task before writing any code."*
3. **Pinned context:** Pin `docs/AGENT_RULES.md` as a permanent context file so the agent always has it in its context window.
4. **Agent opening instruction:** The very first line of your agent system prompt should be:

```
You are a senior full-stack engineer building an Employee Self-Service Portal.
Before every task, read docs/AGENT_RULES.md completely and follow it strictly.
Never deviate from the folder structure, tech stack, design system, or security rules defined there.
```

---

*Last updated: August 2026 | Version 1.1*
*This document is the single source of truth for this project. Update it when conventions change, never work around it.*

---

### Reports Module

Monthly Project Report — generates from live task/history data.

Report is GENERATED on demand (not pre-stored).
SAVED reports are frozen JSON snapshots in ProjectReport.reportData.

Generation: generateProjectReport() in src/lib/reports/generateReport.ts
PDF: generateReportPDFBlob() in src/lib/reports/ReportPDF.tsx
     A4 landscape, react-pdf, 5 sections.

Active tasks = created OR had transitions OR completed in the month.
Completed = task reached requiresActualEffort stage in that month.

Sharing: public UUID token, 30-day expiry, no auth required for shared link.
Shared link route: /reports/shared/[token] (outside (portal) route group).

ADMIN: generate, save, share, delete any project report.
EMPLOYEE: view saved reports for their projects only.

Sidebar: "Reports" under ADMIN ONLY group.
         For employees: show only if they have accessible saved reports.