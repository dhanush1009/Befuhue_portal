'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useMyProfile } from '@/hooks/useMyProfile';
import { calculateProfileCompleteness } from '@/lib/profileCompleteness';
import { useUIStore } from '@/store/useUIStore';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ProfileCardSkeleton } from '@/components/profile/ProfileCardSkeleton';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { MobileProfileHeader } from '@/components/profile/MobileProfileHeader';

export default function ProfilePage() {
  const { profile } = useMyProfile();
  const setPageTitle = useUIStore((s) => s.setPageTitle);
  const [activeTab, setActiveTab] = useState('personal');
  const [isDirty,   setIsDirty]   = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Links like /profile?tab=details open that tab directly
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && ['personal', 'details', 'work', 'activity', 'security'].includes(t)) setActiveTab(t);
  }, []);

  useEffect(() => {
    setPageTitle('Profile');
    return () => setPageTitle('Dashboard');
  }, [setPageTitle]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (profile.isLoading) {
    return (
      <div className="max-w-6xl mx-auto pb-10 flex flex-col lg:flex-row gap-6 p-4 lg:p-6">
        <div className="hidden lg:block w-80 shrink-0"><ProfileCardSkeleton /></div>
        <div className="flex-1 bg-gray-100 dark:bg-surface-dark-3 animate-pulse rounded-xl min-h-[400px]" />
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-status-absent mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Failed to load profile</p>
          <p className="text-sm text-gray-400 dark:text-violet-300/45 mb-4">Something went wrong. Please try again.</p>
          <button
            onClick={() => void profile.refetch()}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const user         = profile.data;
  const completeness = calculateProfileCompleteness(user);

  return (
    <>
      {/* Page header */}
      <div className="px-4 lg:px-6 pt-6 pb-0">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-400 dark:text-violet-300/45 mt-1">Manage your personal information and account settings.</p>
      </div>

      {/* Mobile compact header */}
      <div className="block lg:hidden px-4 pt-4">
        <MobileProfileHeader user={user} completeness={completeness} />
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-6 p-4 lg:p-6 max-w-6xl mx-auto pb-24 lg:pb-10">

        {/* Left column — desktop only */}
        <motion.div
          className="hidden lg:block w-80 shrink-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <ProfileCard
            user={user}
            isClockedIn={user.isClockedIn}
            isOnLeaveToday={user.isOnLeave}
            attendanceSummary={user.attendanceSummary}
            leaveBalances={user.leaveBalances}
            completeness={completeness}
            onTabChange={setActiveTab}
          />
        </motion.div>

        {/* Right column */}
        <motion.div
          className="flex-1 min-w-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          <ProfileTabs
            user={user}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isDirty={isDirty}
            onDirtyChange={setIsDirty}
            formRef={formRef}
          />
        </motion.div>
      </div>

      {/* Mobile floating save bar — only when dirty and on mobile */}
      <AnimatePresence>
        {isDirty && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-surface-dark-2 border-t border-gray-200 dark:border-violet-900/40 px-4 py-3 z-50 flex gap-3 lg:hidden"
            initial={{ y: 80 }}
            animate={{ y: 0 }}
            exit={{ y: 80 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => setIsDirty(false)}
              className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover transition-colors duration-150 active:scale-[0.98]"
            >
              <Loader2 className="w-3.5 h-3.5 hidden" />
              Save Changes
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
