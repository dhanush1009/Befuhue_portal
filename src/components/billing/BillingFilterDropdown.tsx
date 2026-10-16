'use client';

import { useState, useRef, useEffect, useMemo, ReactNode } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterDropdownItem {
  id: string;
  name: string;
  subtitle?: string;
  badge?: string | number;
}

interface BillingFilterDropdownProps {
  label: string;
  icon: ReactNode;
  isActive: boolean;
  selectedId?: string | null;
  selectedLabel?: string | null;
  allOptionLabel: string;
  allOptionCount?: number;
  items: FilterDropdownItem[];
  onSelectAll: () => void;
  onSelectItem: (id: string) => void;
}

export function BillingFilterDropdown({
  label,
  icon,
  isActive,
  selectedId,
  selectedLabel,
  allOptionLabel,
  allOptionCount,
  items,
  onSelectAll,
  onSelectItem,
}: BillingFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Filter items if search is used
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [items, searchTerm]);

  const buttonDisplayText = useMemo(() => {
    if (isActive && selectedLabel) {
      return `${label}: ${selectedLabel}`;
    }
    return label;
  }, [isActive, selectedLabel, label]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setSearchTerm('');
        }}
        className={cn(
          'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none',
          isActive
            ? 'bg-brand text-white shadow-xs'
            : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/5'
        )}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {icon}
        <span className="truncate max-w-[140px] sm:max-w-[180px]">{buttonDisplayText}</span>
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-200 shrink-0 opacity-70',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white dark:bg-surface-dark-2 border border-gray-200/90 dark:border-white/10 shadow-xl ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search box if there are more than 4 items */}
          {items.length > 4 && (
            <div className="p-2 border-b border-gray-100 dark:border-white/10">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-surface-dark-3 border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand text-gray-900 dark:text-white placeholder-gray-400"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* List of Options */}
          <div className="p-1.5 max-h-64 overflow-y-auto space-y-0.5">
            {/* "All" Option inside dropdown */}
            {!searchTerm && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onSelectAll();
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-left',
                    isActive && !selectedId
                      ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light font-bold'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-surface-dark-3'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{allOptionLabel}</span>
                    {allOptionCount !== undefined && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-zinc-400">
                        {allOptionCount}
                      </span>
                    )}
                  </div>
                  {isActive && !selectedId && <Check className="size-3.5 text-brand shrink-0" />}
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-white/5" />
              </>
            )}

            {/* Individual Items */}
            {filteredItems.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400 dark:text-zinc-500">
                No {label.toLowerCase()} found
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = isActive && selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectItem(item.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors cursor-pointer text-left',
                      isSelected
                        ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light font-bold'
                        : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-surface-dark-3'
                    )}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="font-medium truncate">{item.name}</p>
                      {item.subtitle && (
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge !== undefined && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-gray-500 dark:text-zinc-400">
                          {item.badge}
                        </span>
                      )}
                      {isSelected && <Check className="size-3.5 text-brand shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
