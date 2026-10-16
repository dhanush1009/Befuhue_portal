'use client';

import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { useEmployeeList } from '@/hooks/useTasks';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MentionItem {
  id:          string;
  name:        string;
  avatarUrl:   string | null;
  designation: string | null;
}

interface SuggestionItem { id: string; label: string; }

interface MentionListProps {
  items:   MentionItem[];
  command: (item: SuggestionItem) => void;
}

// ── Extract mention IDs from Tiptap JSON ──────────────────────────────────────

export function extractMentions(doc: Record<string, unknown>): string[] {
  const ids: string[] = [];
  function walk(node: Record<string, unknown>) {
    if (node.type === 'mention' && node.attrs) {
      const id = (node.attrs as Record<string, unknown>).id as string;
      if (id) ids.push(id);
    }
    (node.content as Record<string, unknown>[] | undefined)?.forEach(walk);
  }
  walk(doc);
  return [...new Set(ids)];
}

// ── Mention suggestion list ───────────────────────────────────────────────────

const MentionList = forwardRef<
  { onKeyDown: (p: { event: KeyboardEvent }) => boolean },
  MentionListProps
>(function MentionList({ items, command }, ref) {
  const [selected, setSelected] = useState(0);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (event.key === 'ArrowUp')   { setSelected((s) => (s - 1 + items.length) % items.length); return true; }
      if (event.key === 'ArrowDown') { setSelected((s) => (s + 1) % items.length); return true; }
      if (event.key === 'Enter') {
        const item = items[selected];
        if (item) command({ id: item.id, label: item.name });
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-lg shadow-lg p-2 text-xs text-gray-400">
        No users found
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-dark-2 border border-gray-200 dark:border-violet-900/40 rounded-lg shadow-lg overflow-hidden min-w-[200px] z-[9999]">
      {items.map((item, i) => (
        <button
          key={item.id}
          onClick={() => command({ id: item.id, label: item.name })}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors duration-100 ${
            i === selected ? 'bg-violet-50 dark:bg-violet-900/30' : 'hover:bg-gray-50 dark:hover:bg-surface-dark-3'
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-brand-light text-brand flex items-center justify-center text-[10px] font-semibold overflow-hidden shrink-0">
            {item.avatarUrl
              ? <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
              : getInitials(item.name)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{item.name}</p>
            {item.designation && (
              <p className="text-[11px] text-gray-400 dark:text-violet-300/45 truncate">{item.designation}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
});

// ── CommentEditor ─────────────────────────────────────────────────────────────

interface CommentEditorProps {
  taskId:    string;
  onSubmit:  (body: Record<string, unknown>, bodyText: string, mentionIds: string[]) => void;
  isPending: boolean;
}

export function CommentEditor({ taskId: _taskId, onSubmit, isPending }: CommentEditorProps) {
  const [emptyError, setEmptyError] = useState(false);

  // Fetched once, cached for 10 min — no per-keystroke network requests
  const { data: employees = [] } = useEmployeeList();
  // Ref bridges the cached list into the Tiptap closure without recreating the editor
  const employeesRef = useRef<MentionItem[]>(employees);
  employeesRef.current = employees;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Write a comment… Use @ to mention someone' }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }: { query: string }): MentionItem[] => {
            const q = query.toLowerCase();
            return employeesRef.current
              .filter((e) => e.name.toLowerCase().includes(q))
              .slice(0, 5);
          },
          render: () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let component: ReactRenderer<any>;
            let popup: TippyInstance[];

            return {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onStart(props: any) {
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                if (!props.clientRect) return;
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content:  component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger:  'manual',
                  placement: 'bottom-start',
                  zIndex:   9999,
                });
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onUpdate(props: any) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0]?.setProps({ getReferenceClientRect: props.clientRect });
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onKeyDown(props: any) {
                if (props.event.key === 'Escape') { popup[0]?.hide(); return true; }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (component.ref as any)?.onKeyDown(props) ?? false;
              },
              onExit() {
                popup[0]?.destroy();
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'tiptap-content min-h-[72px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none',
      },
    },
  });

  function handleSubmit() {
    if (!editor) return;
    const bodyText = editor.getText().trim();
    if (!bodyText) { setEmptyError(true); return; }
    setEmptyError(false);
    const body = editor.getJSON() as Record<string, unknown>;
    onSubmit(body, bodyText, extractMentions(body));
    editor.commands.clearContent();
  }

  return (
    <div className="space-y-1">
      <div
        className={`border rounded-lg overflow-hidden transition-colors duration-150 ${
          emptyError
            ? 'border-status-absent'
            : 'border-gray-200 dark:border-violet-900/40 focus-within:ring-2 focus-within:ring-brand focus-within:border-transparent'
        }`}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); } }}
      >
        <EditorContent editor={editor} />
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-surface-dark-3/50 border-t border-gray-100 dark:border-violet-900/40">
          <span className="text-[11px] text-gray-400 dark:text-violet-300/45">⌘+Enter to post · @ to mention</span>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand-hover disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Post
          </button>
        </div>
      </div>
      {emptyError && <p className="text-xs text-status-absent">Comment cannot be empty.</p>}
    </div>
  );
}
