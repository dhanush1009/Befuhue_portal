'use client';

import { useRef, useState } from 'react';
import { FileText, Image, File, Download, Trash2, Plus, Loader2, FolderOpen } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SkeletonCard } from '@/components/shared/SkeletonCard';
import { useEmployeeDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useEmployees';
import { toast } from 'sonner';
import type { EmployeeDocument } from '@/types';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED   = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

function fileIcon(mimeType: string) {
  if (mimeType === 'application/pdf')                return <FileText className="w-8 h-8 text-red-500" />;
  if (mimeType.startsWith('image/'))                 return <Image    className="w-8 h-8 text-emerald-500" />;
  return <File className="w-8 h-8 text-blue-500" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentCardProps {
  doc:       EmployeeDocument;
  canDelete: boolean;
  onDelete:  (id: string) => void;
}

function DocumentCard({ doc, canDelete, onDelete }: DocumentCardProps) {
  return (
    <div className="bg-white dark:bg-surface-dark-3 rounded-xl border border-gray-200 dark:border-violet-900/40 p-4 hover:border-violet-200 dark:hover:border-violet-500 transition-colors duration-150">
      <div className="flex items-start gap-3">
        <div className="shrink-0">{fileIcon(doc.mimeType)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.name}</p>
          <p className="text-xs text-gray-400 dark:text-violet-300/45 mt-0.5">
            {formatBytes(doc.sizeBytes)} · {formatDate(doc.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-violet-900/40">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover transition-colors duration-150"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
        {canDelete && (
          <button
            onClick={() => onDelete(doc.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-status-absent hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-md transition-colors duration-150 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

interface DocumentsTabProps {
  employeeId: string;
  canUpload:  boolean;
  canDelete:  boolean;
}

export function DocumentsTab({ employeeId, canUpload, canDelete }: DocumentsTabProps) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: docs, isLoading } = useEmployeeDocuments(employeeId);
  const upload = useUploadDocument(employeeId);
  const remove = useDeleteDocument(employeeId);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { toast.error('File type not allowed. Use PDF, JPG, PNG, or DOC.'); return; }
    if (file.size > MAX_BYTES)        { toast.error('File too large. Maximum size is 5MB.'); return; }
    setUploading(true);
    upload.mutate(file, { onSettled: () => { setUploading(false); if (fileRef.current) fileRef.current.value = ''; } });
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(docs ?? []).map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            canDelete={canDelete}
            onDelete={setDeleteId}
          />
        ))}

        {canUpload && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-violet-900/40 p-8 text-gray-400 hover:border-brand hover:text-brand dark:hover:border-violet-500 transition-colors duration-150 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Plus className="w-6 h-6" />
            )}
            <span className="text-sm font-medium">{uploading ? 'Uploading…' : 'Upload Document'}</span>
            <span className="text-xs">PDF, JPG, PNG, DOC · Max 5MB</span>
          </button>
        )}

        {(docs ?? []).length === 0 && !canUpload && (
          <div className="col-span-full">
            <EmptyState
              icon={<FolderOpen className="w-10 h-10 text-gray-300 dark:text-violet-400/35" />}
              title="No documents"
              description="No documents have been uploaded yet."
            />
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Document"
        description="Are you sure you want to delete this document? This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (deleteId) remove.mutate(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
