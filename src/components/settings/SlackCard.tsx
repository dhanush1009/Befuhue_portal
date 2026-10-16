'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMySlack, useSetSlackMuted, useSlackMatch, useSlackStatus, useSlackTest } from '@/hooks/useSlack';

const STEPS = [
  'Go to api.slack.com/apps and click Create New App → From scratch. Name it "Deep Impression Portal" and pick your workspace.',
  'Open OAuth & Permissions → Bot Token Scopes and add: chat:write, im:write, users:read, users:read.email and channels:read.',
  'Click Install to Workspace and allow it. Copy the Bot User OAuth Token (it starts with xoxb-).',
  'In Slack, create or pick a channel for company posts, open its details and copy the Channel ID (starts with C). Then type /invite @Deep Impression Portal in that channel.',
  'In Vercel → Settings → Environment Variables add SLACK_BOT_TOKEN (the token) and SLACK_CHANNEL_ID (the channel id), then redeploy.',
];

/** Admin: connection status, a test button, and matching people to their Slack accounts. */
export function SlackCard() {
  const status = useSlackStatus();
  const test = useSlackTest();
  const match = useSlackMatch();
  const [showSteps, setShowSteps] = useState(false);
  const s = status.data;

  const connected = !!s?.connected;
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 px-5 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Slack</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
            Private messages for tasks, leave and approvals, plus company posts for announcements, polls, holidays and birthdays.
          </p>
        </div>
        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full shrink-0', connected ? 'bg-green-50 text-status-present dark:bg-green-900/20' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-violet-300/55')}>
          {status.isLoading ? 'Checking…' : connected ? 'Connected' : s?.configured ? 'Problem' : 'Not connected'}
        </span>
      </div>

      {s?.problem && (
        <p className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400"><AlertTriangle className="w-4 h-4 shrink-0" /> {s.problem}</p>
      )}

      {connected && s && (
        <div className="space-y-3">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-gray-400 dark:text-violet-300/45">Workspace</dt><dd className="text-gray-900 dark:text-white">{s.workspace ?? '—'}</dd></div>
            <div><dt className="text-xs text-gray-400 dark:text-violet-300/45">Company channel</dt><dd className="text-gray-900 dark:text-white">{s.channelSet ? (s.channelName ? `#${s.channelName}` : 'Set') : 'Not set (add SLACK_CHANNEL_ID)'}</dd></div>
            <div><dt className="text-xs text-gray-400 dark:text-violet-300/45">People linked</dt><dd className="text-gray-900 dark:text-white">{s.people.linked} of {s.people.total}</dd></div>
          </dl>
          {s.channelProblem && (
            <p className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400"><AlertTriangle className="w-4 h-4 shrink-0" /> Company channel: {s.channelProblem}</p>
          )}
          {s.channelProblem && s.channels.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-violet-900/40 p-3">
              <p className="text-xs font-medium text-gray-700 dark:text-violet-200/70 mb-2">Channels the app can see. Copy the ID of the one you want into SLACK_CHANNEL_ID in Vercel:</p>
              <ul className="space-y-1 max-h-40 overflow-auto">
                {s.channels.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-900 dark:text-white">#{c.name}{c.isMember ? '' : ' (app not added yet)'}</span>
                    <code className="font-mono text-gray-500 dark:text-violet-300/55 select-all">{c.id}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => test.mutate()} disabled={test.isPending} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60">
              {test.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send test message
            </button>
            <button type="button" onClick={() => match.mutate()} disabled={match.isPending} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-60">
              {match.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />} Match people by email
            </button>
          </div>
          {match.data && (
            <div className="text-xs space-y-1">
              <p className="flex items-center gap-1.5 text-green-600 dark:text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> {match.data.matched.length} linked</p>
              {match.data.unmatched.length > 0 && (
                <p className="text-amber-600 dark:text-amber-400">
                  No Slack account found for: {match.data.unmatched.map((u) => u.name).join(', ')}. Their Slack email must match their portal work email. They still get in-app notifications.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!connected && (
        <div>
          <button type="button" onClick={() => setShowSteps((v) => !v)} className="text-sm font-medium text-brand hover:underline">{showSteps || !s?.configured ? 'Hide setup steps' : 'Show setup steps'}</button>
          {(showSteps || !s?.configured) && (
            <ol className="mt-3 space-y-2 list-decimal pl-5 text-sm text-gray-600 dark:text-violet-200/70">
              {STEPS.map((t) => <li key={t}>{t}</li>)}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/** Everyone: turn their own Slack messages on or off. Hidden until an admin has connected Slack. */
export function SlackMyToggle() {
  const me = useMySlack();
  const set = useSetSlackMuted();
  if (!me.data?.available) return null;
  const on = !me.data.muted;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">Slack</p>
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 flex items-center justify-between px-5 py-4 gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">Send my notifications to Slack</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
            {me.data.linked ? 'Tasks, leave and approvals arrive as a private Slack message.' : 'We have not found your Slack account yet. It is matched by your work email.'}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={on} disabled={set.isPending} onClick={() => set.mutate(on)}
          className={cn('relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1', on ? 'bg-brand' : 'bg-gray-200 dark:bg-surface-dark-3')}>
          <span className={cn('pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200', on ? 'translate-x-4' : 'translate-x-0')} />
        </button>
      </div>
    </div>
  );
}
