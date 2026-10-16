'use client';

import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Camera, ZoomIn, ZoomOut, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn, getInitials } from '@/lib/utils';
import { getCroppedImage, createObjectURL, revokeObjectURL } from '@/lib/imageUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AvatarUploadProps {
  currentAvatarUrl: string | null;
  userName:         string;
  size?:            'md' | 'lg';
  onUploadComplete: (newUrl: string | null) => void;
}

type UploadState = 'idle' | 'cropping' | 'uploading';

const SIZE_PX = { md: 80, lg: 120 } as const;

// ── Deterministic color from name hash ────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AvatarUpload({ currentAvatarUrl, userName, size = 'md', onUploadComplete }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const px       = SIZE_PX[size];

  const [state,              setState]              = useState<UploadState>('idle');
  const [imageSrc,           setImageSrc]           = useState<string | null>(null);
  const [crop,               setCrop]               = useState({ x: 0, y: 0 });
  const [zoom,               setZoom]               = useState(1);
  const [croppedAreaPixels,  setCroppedAreaPixels]  = useState<Area | null>(null);
  const [uploadError,        setUploadError]        = useState('');
  const [imgError,           setImgError]           = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // ── File selection ─────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB.');
      return;
    }
    const url = createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setUploadError('');
    setState('cropping');
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  // ── Cancel crop ────────────────────────────────────────────────────────────

  function handleCancel() {
    if (imageSrc) revokeObjectURL(imageSrc);
    setImageSrc(null);
    setState('idle');
    setUploadError('');
  }

  // ── Apply crop → upload ────────────────────────────────────────────────────

  async function handleApplyCrop() {
    if (!imageSrc || !croppedAreaPixels) return;
    setState('uploading');
    setUploadError('');

    try {
      const blob = await getCroppedImage(imageSrc, croppedAreaPixels, 400);
      revokeObjectURL(imageSrc);
      setImageSrc(null);

      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      const form = new FormData();
      form.append('file', file);

      const res  = await fetch('/api/employees/me/avatar', { method: 'POST', body: form });
      // Safe parse — consistent with DELETE handler
      const text = await res.text();
      const json = text ? (JSON.parse(text) as { avatarUrl?: string; error?: string }) : {};

      if (!res.ok) throw new Error(json.error ?? 'Upload failed');

      onUploadComplete(json.avatarUrl ?? null);
      toast.success('Profile photo updated.');
      setState('idle');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setState('uploading'); // keep modal open
    }
  }

  // ── Remove avatar ──────────────────────────────────────────────────────────

  async function handleRemove() {
    try {
      const res  = await fetch('/api/employees/me/avatar', { method: 'DELETE' });
      // Safe parse — never call res.json() directly; body may be empty on some responses
      const text = await res.text();
      const data = text ? (JSON.parse(text) as { success?: boolean; error?: string }) : {};
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove photo.');
      onUploadComplete(null);
      setImgError(false);
      toast.success('Profile photo removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove photo.');
    }
  }

  const colorClass = nameToColor(userName);
  const isUploading = state === 'uploading';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar circle with hover overlay */}
      <div
        className="relative group cursor-pointer shrink-0"
        style={{ width: px, height: px }}
        onClick={() => inputRef.current?.click()}
      >
        <div
          className={cn(
            'w-full h-full rounded-full overflow-hidden flex items-center justify-center font-semibold border-2 border-white dark:border-violet-900/40 shadow-sm',
            colorClass,
          )}
          style={{ fontSize: px * 0.3 }}
        >
          {currentAvatarUrl && !imgError ? (
            <img
              src={currentAvatarUrl}
              alt={userName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            getInitials(userName)
          )}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-1">
          <Camera className="text-white" style={{ width: px * 0.22, height: px * 0.22 }} />
          {size === 'lg' && (
            <span className="text-white text-xs font-medium">Change photo</span>
          )}
        </div>
      </div>

      {/* Text links */}
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-brand hover:text-brand-hover font-medium transition-colors duration-150"
        >
          Upload photo
        </button>
        {currentAvatarUrl && !imgError && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-status-absent hover:text-red-700 font-medium transition-colors duration-150"
          >
            Remove photo
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Crop / Upload modal — rendered via portal directly into document.body */}
      {(state === 'cropping' || state === 'uploading') && imageSrc && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={!isUploading ? handleCancel : undefined}
          />

          {/* Modal — overflow-hidden clips the dark crop area to rounded corners */}
          <div className="relative bg-white dark:bg-surface-dark-2 rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 overflow-hidden border border-gray-200 dark:border-violet-900/40">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-violet-900/30">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Crop your photo</h2>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isUploading}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Crop area — react-easy-crop needs position:absolute internally to fill the container */}
            <div
              style={{ position: 'relative', height: 320, background: '#1a1a1a', overflow: 'hidden' }}
            >
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: {
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                  },
                  cropAreaStyle: {
                    border: '2px dashed rgba(255,255,255,0.75)',
                  },
                  mediaStyle: {},
                }}
              />
            </div>

            {/* Controls */}
            <div className="px-5 pt-4 pb-2 space-y-3 bg-white dark:bg-surface-dark-2">
              <div className="flex items-center gap-3">
                <ZoomOut
                  className="w-4 h-4 text-gray-400 shrink-0 cursor-pointer"
                  onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
                />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-violet-600 cursor-pointer"
                  disabled={isUploading}
                />
                <ZoomIn
                  className="w-4 h-4 text-gray-400 shrink-0 cursor-pointer"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                />
              </div>

              <p className="text-xs text-gray-400 dark:text-violet-300/45 text-center">
                Drag to reposition · Scroll or use slider to zoom
              </p>

              {isUploading && !uploadError && (
                <div className="h-1.5 w-full bg-gray-100 dark:bg-surface-dark-3 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full animate-pulse w-2/3" />
                </div>
              )}

              {uploadError && (
                <p className="text-xs text-status-absent text-center">{uploadError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 py-4 bg-white dark:bg-surface-dark-2 border-t border-gray-100 dark:border-violet-900/30">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-violet-900/40 rounded-lg text-gray-700 dark:text-violet-200/70 hover:bg-gray-50 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCrop}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]"
              >
                {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isUploading ? 'Uploading…' : 'Apply crop'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
