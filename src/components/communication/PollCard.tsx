'use client';

import { useState } from 'react';
import { BarChart2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePolls, useVotePoll, type Poll } from '@/hooks/useCommunication';
import { useAuth } from '@/hooks/useAuth';
import { EmptyState } from '@/components/shared/EmptyState';
import { CreatePollModal } from './CreatePollModal';

const BAR_COLORS = ['#8E51FF', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#059669'];

interface PollResultsProps {
  poll: Poll;
}

function PollResults({ poll }: PollResultsProps) {
  const max = Math.max(...poll.voteCounts, 1);
  return (
    <div className="space-y-2 mt-3">
      {poll.options.map((opt, i) => {
        const count = poll.voteCounts[i] ?? 0;
        const pct   = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
        return (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-700 dark:text-violet-200/70 truncate flex-1">{opt}</span>
              <span className="text-gray-500 dark:text-violet-300/55 ml-2 shrink-0">{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(count / max) * 100}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-2">{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</p>
    </div>
  );
}

interface SinglePollProps {
  poll:       Poll;
  isAdmin:    boolean;
  onNewPoll:  () => void;
}

function SinglePoll({ poll, isAdmin, onNewPoll }: SinglePollProps) {
  const vote = useVotePoll();
  const [optimisticVoted, setOptimisticVoted] = useState(false);
  const [optimisticCounts, setOptimisticCounts] = useState<number[] | null>(null);

  const isExpired = poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false;
  const showResults = poll.hasVoted || optimisticVoted || isExpired;
  const displayCounts = optimisticCounts ?? poll.voteCounts;

  function handleVote(idx: number) {
    // Optimistic update
    const newCounts = [...poll.voteCounts];
    newCounts[idx] = (newCounts[idx] ?? 0) + 1;
    setOptimisticCounts(newCounts);
    setOptimisticVoted(true);
    vote.mutate({ pollId: poll.id, optionIndex: idx });
  }

  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider">Poll</p>
        <div className="flex items-center gap-2">
        {isAdmin && (
          <button
            onClick={onNewPoll}
            title="New poll"
            className="p-1 rounded-md text-gray-400 hover:text-brand hover:bg-brand-light dark:hover:bg-violet-900/30 transition-colors duration-150"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
        {isExpired && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-violet-300/55">
            Poll closed
          </span>
        )}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{poll.question}</p>

      {showResults ? (
        <PollResults poll={{ ...poll, voteCounts: displayCounts, totalVotes: displayCounts.reduce((a, b) => a + b, 0) }} />
      ) : (
        <div className="space-y-2">
          {poll.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={vote.isPending}
              className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-violet-900/40 text-gray-700 dark:text-violet-200/70 hover:border-brand hover:bg-brand-light dark:hover:bg-violet-900/20 dark:hover:border-violet-500 transition-colors duration-150 disabled:opacity-60"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PollCard() {
  const { isAdmin } = useAuth();
  const { data: polls, isLoading } = usePolls();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 animate-pulse">
        <div className="h-3 bg-gray-200 dark:bg-surface-dark-3 rounded w-1/4 mb-3" />
        <div className="h-4 bg-gray-200 dark:bg-surface-dark-3 rounded w-3/4 mb-4" />
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 bg-gray-100 dark:bg-surface-dark-3 rounded-lg mb-2" />)}
      </div>
    );
  }

  const activePoll = polls?.find((p) => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > new Date()));

  if (!activePoll) {
    return (
      <>
        <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4">
          <EmptyState
            icon={<BarChart2 className="w-8 h-8 text-gray-300 dark:text-violet-400/35" />}
            title="No active polls"
            description="Check back later."
            action={isAdmin ? (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand border border-brand/30 rounded-lg hover:bg-brand/5 transition-colors duration-150"
              >
                <Plus className="w-3.5 h-3.5" /> New Poll
              </button>
            ) : undefined}
          />
        </div>
        {showCreate && <CreatePollModal onClose={() => setShowCreate(false)} />}
      </>
    );
  }

  return (
    <>
      <SinglePoll poll={activePoll} isAdmin={isAdmin} onNewPoll={() => setShowCreate(true)} />
      {showCreate && <CreatePollModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
