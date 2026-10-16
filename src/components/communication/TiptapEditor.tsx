'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Link2, Heading2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TiptapEditorProps {
  content?:    Record<string, unknown>;
  onChange:    (json: Record<string, unknown>) => void;
  placeholder?: string;
  className?:  string;
}

export function TiptapEditor({ content, onChange, placeholder = 'Write something…', className }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: content ?? '',
    onUpdate: ({ editor }) => onChange(editor.getJSON() as Record<string, unknown>),
  });

  if (!editor) return null;

  const btnClass = (active: boolean) => cn(
    'p-1.5 rounded text-sm transition-colors duration-150',
    active
      ? 'bg-brand text-white'
      : 'text-gray-500 dark:text-violet-300/55 hover:bg-gray-100 dark:hover:bg-surface-dark-3',
  );

  function setLink() {
    const url = window.prompt('URL');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className={cn('border border-gray-200 dark:border-violet-900/40 rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 dark:border-violet-900/40 bg-gray-50 dark:bg-surface-dark-3/50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}          className={btnClass(editor.isActive('bold'))}><Bold className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}        className={btnClass(editor.isActive('italic'))}><Italic className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))}><Heading2 className="w-3.5 h-3.5" /></button>
        <div className="w-px h-4 bg-gray-200 dark:bg-surface-dark-3 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}    className={btnClass(editor.isActive('bulletList'))}><List className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}   className={btnClass(editor.isActive('orderedList'))}><ListOrdered className="w-3.5 h-3.5" /></button>
        <div className="w-px h-4 bg-gray-200 dark:bg-surface-dark-3 mx-1" />
        <button type="button" onClick={setLink}                                                  className={btnClass(editor.isActive('link'))}><Link2 className="w-3.5 h-3.5" /></button>
      </div>
      <EditorContent
        editor={editor}
        className="tiptap-content min-h-[120px] px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none"
      />
    </div>
  );
}
