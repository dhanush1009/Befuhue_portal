'use client';

import Link from 'next/link';
import { Bot, ArrowRight } from 'lucide-react';

export function ConnectLLMCard() {
  return (
    <Link
      href="/settings?tab=connectLLM"
      className="group block bg-white dark:bg-surface-dark-3 border border-black/10 dark:border-white/10 rounded-2xl p-5 hover:border-brand/40 dark:hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-100 dark:hover:shadow-black/30 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/10 dark:bg-violet-500/15 flex items-center justify-center shrink-0">
          <Bot className="w-4.5 h-4.5 text-brand dark:text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Connect Your LLM</p>
          <p className="text-xs text-gray-500 dark:text-violet-300/55 mt-0.5 leading-relaxed">
            Fetch tasks, assign work, and manage status straight from Claude, Cursor, or any MCP-compatible client.
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 dark:text-violet-400/40 group-hover:text-brand dark:group-hover:text-violet-300 group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" />
      </div>
    </Link>
  );
}
