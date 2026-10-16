'use client';

import { useEffect } from 'react';
import { motion, type Easing } from 'framer-motion';
import { CalendarOff, CheckSquare, FlaskConical, Users, AlertTriangle, CalendarClock, CheckCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/store/useUIStore';
import {
  useDashboardStats,
  useDashboardOverview,
  useTeamPresence,
  useUpcomingLeaves,
  useMyTasks,
} from '@/hooks/useDashboard';
import { useHeadsUp } from '@/hooks/useTimeline';
import { HeadsUpBoard } from '@/components/attendance/HeadsUpBoard';
import { KpiCard } from '@/components/ui/KpiCard';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { TaskPipelineCard } from '@/components/dashboard/TaskPipelineCard';
import { UpcomingHolidays } from '@/components/dashboard/UpcomingHolidays';
import { Celebrations } from '@/components/dashboard/Celebrations';
import { DetailsNudge } from '@/components/dashboard/DetailsNudge';
import { BirthdayBanner } from '@/components/dashboard/BirthdayBanner';
import { WeeklyAttendanceBar, WeeklyAttendanceBarSkeleton } from '@/components/dashboard/WeeklyAttendanceBar';
import { MyTasksList, MyTasksListSkeleton } from '@/components/dashboard/MyTasksList';
import { TeamPresenceList, TeamPresenceListSkeleton } from '@/components/dashboard/TeamPresenceList';
import { UpcomingLeaves, UpcomingLeavesSkeleton } from '@/components/dashboard/UpcomingLeaves';
import { QuoteDisplay } from '@/components/dashboard/QuoteDisplay';
import { ConnectLLMCard } from '@/components/dashboard/ConnectLLMCard';
import { TaskCompletionGraph } from '@/components/dashboard/TaskCompletionGraph';
import { PerformanceGraph } from '@/components/dashboard/PerformanceGraph';
import { TopPerformerLeaderboard } from '@/components/dashboard/TopPerformerLeaderboard';
import { usePerformance } from '@/hooks/usePerformance';

const fadeIn = {
  hidden:  { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.15, delay: i * 0.05, ease: 'easeOut' as Easing },
  }),
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { setPageTitle } = useUIStore();

  const statsQuery    = useDashboardStats();
  const overviewQuery = useDashboardOverview();
  const presenceQuery = useTeamPresence();
  const leavesQuery   = useUpcomingLeaves();
  const tasksQuery    = useMyTasks();
  const headsUpQuery  = useHeadsUp(7);
  const perfQuery     = usePerformance({ view: isAdmin ? 'team' : 'employee' });

  useEffect(() => { setPageTitle('Dashboard'); }, [setPageTitle]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstName = (user as any)?.name?.split(' ')[0] ?? 'there';
  const stats = statsQuery.data;
  const ov = overviewQuery.data;
  const presence = presenceQuery.data ?? [];

  const closedTotal = (ov?.closedByDay ?? []).reduce((s, d) => s + d.count, 0);
  const inReview = (ov?.taskStatus.INTERNAL_REVIEW ?? 0) + (ov?.taskStatus.CLIENT_REVIEW ?? 0);

  const summary = isAdmin
    ? <>
        <strong className="font-semibold text-zinc-950 dark:text-white">{stats?.presentToday ?? '–'}</strong> of {stats?.totalEmployees ?? '–'} teammates are in today.
        {' '}{stats ? plural(stats.openTasks, 'task is', 'tasks are') : 'Tasks are'} open
        {inReview > 0 && <>, <strong className="font-semibold text-zinc-950 dark:text-white">{inReview}</strong> waiting in review</>}
        {(stats?.pendingApprovals ?? 0) > 0 && <>, and <strong className="font-semibold text-brand">{plural(stats!.pendingApprovals!, 'approval')}</strong> need you</>}.
      </>
    : <>
        You have <strong className="font-semibold text-zinc-950 dark:text-white">{plural(ov?.myOpen ?? 0, 'open task')}</strong>
        {(ov?.dueThisWeek ?? 0) > 0 && <>, <strong className="font-semibold text-zinc-950 dark:text-white">{ov!.dueThisWeek}</strong> due this week</>}
        {(ov?.overdue ?? 0) > 0 && <>, and <strong className="font-semibold text-rose-600 dark:text-rose-400">{ov!.overdue} overdue</strong></>}.
      </>;

  const heroStats = isAdmin
    ? [
        { label: 'Present', value: stats?.presentToday ?? '–' },
        { label: 'Open tasks', value: stats?.openTasks ?? '–' },
        { label: 'Approvals', value: stats?.pendingApprovals ?? '–', accent: (stats?.pendingApprovals ?? 0) > 0 },
      ]
    : [
        { label: 'Open', value: ov?.myOpen ?? '–' },
        { label: 'Due this week', value: ov?.dueThisWeek ?? '–' },
        { label: 'Overdue', value: ov?.overdue ?? '–', accent: (ov?.overdue ?? 0) > 0 },
      ];

  return (
    <motion.div initial="hidden" animate="visible" className="mx-auto flex max-w-screen-xl flex-col gap-4 pb-10">
      <motion.div custom={0} variants={fadeIn}>
        <DashboardHero firstName={firstName} summary={summary} stats={heroStats} present={presence}>
          <QuoteDisplay />
        </DashboardHero>
      </motion.div>

      <motion.div custom={0} variants={fadeIn} className="flex flex-col gap-4 empty:hidden"><BirthdayBanner /><DetailsNudge /></motion.div>

      {/* KPI tiles */}
      <motion.div custom={1} variants={fadeIn} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? (
          <>
            <KpiCard title="Present today" tone="emerald" icon={Users} value={stats?.presentToday ?? '–'} caption={`of ${stats?.totalEmployees ?? 0} employees`} trend={ov?.presenceByDay.map((d) => d.count)} />
            <KpiCard title="Open tasks" tone="violet" icon={CheckSquare} value={stats?.openTasks ?? '–'} caption="not yet done or closed" trend={ov?.createdByDay.map((d) => d.count)} />
            <KpiCard title="In review" tone="amber" icon={FlaskConical} value={stats ? inReview || stats.readyForQACount : '–'} caption={inReview > 0 ? 'internal + client review' : 'nothing waiting'} />
            <KpiCard title="On leave today" tone="rose" icon={CalendarOff} value={stats?.onLeave ?? '–'} caption={`${stats?.pendingApprovals ?? 0} request${stats?.pendingApprovals === 1 ? '' : 's'} awaiting approval`} />
          </>
        ) : (
          <>
            <KpiCard title="My open tasks" tone="violet" icon={CheckSquare} value={ov?.myOpen ?? '–'} caption="assigned to you or shared with you" />
            <KpiCard title="Due this week" tone="amber" icon={CalendarClock} value={ov?.dueThisWeek ?? '–'} caption="next 7 days" />
            <KpiCard title="Overdue" tone="rose" icon={AlertTriangle} value={ov?.overdue ?? '–'} caption={(ov?.overdue ?? 0) > 0 ? 'needs attention' : 'all on track'} />
            <KpiCard title="Closed" tone="emerald" icon={CheckCheck} value={closedTotal} caption="in the last 14 days" trend={ov?.closedByDay.map((d) => d.count)} />
          </>
        )}
      </motion.div>

      {/* Performance Points Graph */}
      <motion.div custom={2} variants={fadeIn}>
        <PerformanceGraph isAdmin={isAdmin} />
      </motion.div>

      {/* Top Performer Spotlight & Leaderboard */}
      <motion.div custom={2} variants={fadeIn}>
        <TopPerformerLeaderboard
          isAdmin={isAdmin}
          topPerformer={perfQuery.data?.topPerformer}
          leaderboard={perfQuery.data?.leaderboard}
          myPerformance={perfQuery.data?.myPerformance}
          isLoading={perfQuery.isLoading}
        />
      </motion.div>

      {/* Task Completion Count Graph */}
      <motion.div custom={3} variants={fadeIn}>
        <TaskCompletionGraph isAdmin={isAdmin} />
      </motion.div>

      {/* Pipeline + presence */}
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div custom={2} variants={fadeIn} className="lg:col-span-2">
          <TaskPipelineCard data={ov} />
        </motion.div>
        <motion.div custom={3} variants={fadeIn}>
          {presenceQuery.isLoading ? <TeamPresenceListSkeleton /> : <TeamPresenceList entries={presence} />}
        </motion.div>
      </div>

      {/* Work + what's coming up */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <motion.div custom={5} variants={fadeIn}>
            {tasksQuery.isLoading ? <MyTasksListSkeleton /> : <MyTasksList tasks={tasksQuery.data ?? []} />}
          </motion.div>
          <motion.div custom={6} variants={fadeIn}>
            {presenceQuery.isLoading ? <WeeklyAttendanceBarSkeleton /> : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <WeeklyAttendanceBar records={presence} currentUserId={(user as any)?.id ?? ''} />
            )}
          </motion.div>
        </div>

        <div className="flex flex-col gap-4">
          {isAdmin && (
            <motion.div custom={4} variants={fadeIn}>
              <HeadsUpBoard
                items={headsUpQuery.data?.items ?? []}
                todayKey={headsUpQuery.data?.today ?? ''}
                title="Heads-up · next 7 days"
                emptyText="Nobody's away or leaving early this week."
              />
            </motion.div>
          )}
          <motion.div custom={5} variants={fadeIn}>
            {leavesQuery.isLoading ? <UpcomingLeavesSkeleton /> : <UpcomingLeaves leaves={leavesQuery.data ?? []} />}
          </motion.div>
          <motion.div custom={6} variants={fadeIn}>
            <UpcomingHolidays />
          </motion.div>
          <motion.div custom={6} variants={fadeIn}>
            <Celebrations />
          </motion.div>
          {isAdmin && (
            <motion.div custom={7} variants={fadeIn}>
              <ConnectLLMCard />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

