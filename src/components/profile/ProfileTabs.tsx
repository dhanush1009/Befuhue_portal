'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PersonalInfoTab } from './tabs/PersonalInfoTab';
import { WorkInfoTab } from './tabs/WorkInfoTab';
import { ActivityTab } from './tabs/ActivityTab';
import { SecurityTab } from './tabs/SecurityTab';
import { EmployeeDetailsForm } from '@/components/details/EmployeeDetailsForm';
import type { MyProfile } from '@/types/profile';

type TabId = 'personal' | 'details' | 'work' | 'activity' | 'security';

const TABS: { id: TabId; label: string }[] = [
  { id: 'personal',  label: 'Personal Info' },
  { id: 'details',   label: 'My Details' },
  { id: 'work',      label: 'Work Info' },
  { id: 'activity',  label: 'Activity' },
  { id: 'security',  label: 'Security' },
];

interface ProfileTabsProps {
  user:          MyProfile;
  activeTab:     string;
  onTabChange:   (tab: string) => void;
  isDirty:       boolean;
  onDirtyChange: (dirty: boolean) => void;
  formRef?:      React.RefObject<HTMLFormElement | null>;
}

export function ProfileTabs({ user, activeTab, onTabChange, isDirty, onDirtyChange, formRef }: ProfileTabsProps) {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 overflow-hidden">

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-100 dark:border-violet-900/40 scrollbar-none px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 border-b-2 -mb-px shrink-0',
              activeTab === tab.id
                ? 'border-brand text-brand dark:text-violet-400'
                : 'border-transparent text-gray-500 dark:text-violet-300/55 hover:text-gray-700 dark:hover:text-violet-200/70',
            )}
          >
            {tab.label}
            {tab.id === 'personal' && isDirty && (
              <span className="absolute top-2 right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content with animation */}
      <div className="p-4 md:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'personal' && (
              <PersonalInfoTab user={user} onDirtyChange={onDirtyChange} formRef={formRef} />
            )}
            {activeTab === 'details'  && <EmployeeDetailsForm employeeId={user.id} isSelf />}
            {activeTab === 'work'     && <WorkInfoTab user={user} />}
            {activeTab === 'activity' && <ActivityTab user={user} />}
            {activeTab === 'security' && <SecurityTab user={user} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
