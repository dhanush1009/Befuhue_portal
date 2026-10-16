'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import { useEffect } from 'react';

interface TiptapViewerProps {
  content:    Record<string, unknown>;
  className?: string;
}

export function TiptapViewer({ content, className }: TiptapViewerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel:    'noopener noreferrer',
        },
      }),
      // Mention must be registered so stored mention nodes don't cause parse errors
      Mention.configure({ HTMLAttributes: { class: 'mention' } }),
    ],
    content,
    editable: false,
    // Suppress the SSR mismatch warning — viewer is always client-only
    immediatelyRender: false,
  });

  // useEditor ignores content prop changes after mount — sync manually
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // Only update if content actually differs to avoid unnecessary re-renders
    const current = JSON.stringify(editor.getJSON());
    const next    = JSON.stringify(content);
    if (current !== next) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  return (
    <div className={className}>
      <EditorContent editor={editor} className="tiptap-content" />
    </div>
  );
}
