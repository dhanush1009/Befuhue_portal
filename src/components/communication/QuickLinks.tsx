'use client';

import { Code2, Pen, HardDrive, Cloud, MessageSquare, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface QuickLink {
  label: string;
  url:   string;
  Icon:  LucideIcon;
  color: string;
}

const DEFAULT_LINKS: QuickLink[] = [
  { label: 'GitHub',       url: 'https://github.com',        Icon: Code2,        color: '#24292e' },
  { label: 'Figma',        url: 'https://figma.com',         Icon: Pen,          color: '#F24E1E' },
  { label: 'Google Drive', url: 'https://drive.google.com',  Icon: HardDrive,    color: '#4285F4' },
  { label: 'AWS',          url: 'https://aws.amazon.com',    Icon: Cloud,        color: '#FF9900' },
  { label: 'Slack',        url: 'https://slack.com',         Icon: MessageSquare,color: '#4A154B' },
  { label: 'Notion',       url: 'https://notion.so',         Icon: BookOpen,     color: '#000000' },
];

export function QuickLinks() {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-violet-300/55 uppercase tracking-wider mb-3">Quick Links</p>
      <div className="grid grid-cols-3 gap-2">
        {DEFAULT_LINKS.map(({ label, url, Icon, color }) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors duration-150 group"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 dark:text-violet-300/55 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-150 text-center leading-tight">
              {label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
