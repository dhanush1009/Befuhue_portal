'use client';

import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Camera, ZoomIn, ZoomOut, X, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getCroppedImage, createObjectURL, revokeObjectURL } from '@/lib/imageUtils';
import { useUploadClientLogo, useRemoveClientLogo } from '@/hooks/useClients';

interface ClientLogoUploadProps {
  clientId:        string;
  currentLogoUrl:  string | null;
  clientName:      string;
  size?:           'md' | 'lg';
}

type UploadState = 'idle' | 'cropping' | 'uploading';

const SIZE_PX = { md: 64, lg: 112 } as const;

export function ClientLogoUpload({ clientId, currentLogoUrl, clientName, size = 'lg' }: ClientLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const px       = SIZE_PX[size];
  const uploadLogo = useUploadClientLogo(clientId);
  const removeLogo = useRemoveClientLogo(clientId);

  const [state,             setState]             = useState<UploadState>('idle');
  const [imageSrc,          setImageSrc]          = useState<string | null>(null);
  const [crop,              setCrop]              = useState({ x: 0, y: 0 });
  const [zoom,              setZoom]              = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploadError,       setUploadError]       = useState('');
  const [imgError,          setImgError]          = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

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
    e.target.value = '';
  }

  function handleCancel() {
    if (imageSrc) revokeObjectURL(imageSrc);
    setImageSrc(null);
    setState('idle');
    setUploadError('');
  }

  async function handleApplyCrop() {
    if (!imageSrc || !croppedAreaPixels) return;
    setState('uploading');
    setUploadError('');

    try {
      const blob = await getCroppedImage(imageSrc, croppedAreaPixels, 400);
      revokeObjectURL(imageSrc);
      setImageSrc(null);

      const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' });
      await uploadLogo.mutateAsync(file);
      setImgError(false);
      setState('idle');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setState('uploading'); // keep modal open
    }
  }

  async function handleRemove() {
    await removeLogo.mutateAsync();
    setImgError(false);
  }

  const isUploading = state === 'uploading';

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative group cursor-pointer shrink-0"
        style={{ width: px, height: px }}
        onClick={() => inputRef.current?.click()}
      >
        <div
          className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-surface-dark-3 border-2 border-white dark:border-violet-900/40 shadow-sm"
        >
          {currentLogoUrl && !imgError ? (
            <img
              src={currentLogoUrl}
              alt={clientName}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <Building2 className="text-gray-300 dark:text-violet-400/35" style={{ width: px * 0.4, height: px * 0.4 }} />
          )}
        </div>

        <div className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-1">
          <Camera className="text-white" style={{ width: px * 0.22, height: px * 0.22 }} />
          {size === 'lg' && (
            <span className="text-white text-xs font-medium">Change logo</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-brand hover:text-brand-hover font-medium transition-colors duration-150"
        >
          Upload logo
        </button>
        {currentLogoUrl && !imgError && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removeLogo.isPending}
            className="text-status-absent hover:text-red-700 font-medium transition-colors duration-150 disabled:opacity-50"
          >
            Remove logo
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {(state === 'cropping' || state === 'uploading') && imageSrc && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={!isUploading ? handleCancel : undefined}
          />

          <div className="relative bg-white dark:bg-surface-dark-2 rounded-2xl shadow-2xl w-full max-w-[520px] mx-4 overflow-hidden border border-gray-200 dark:border-violet-900/40">
            <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-surface-dark-2 border-b border-gray-100 dark:border-violet-900/30">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Crop the logo</h2>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isUploading}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 disabled:opacity-40 transition-colors duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div style={{ position: 'relative', height: 320, background: '#1a1a1a', overflow: 'hidden' }}>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
                  cropAreaStyle: { border: '2px dashed rgba(255,255,255,0.75)' },
                  mediaStyle: {},
                }}
              />
            </div>

            <div className="px-5 pt-4 pb-2 space-y-3 bg-white dark:bg-surface-dark-2">
              <div className="flex items-center gap-3">
                <ZoomOut className="w-4 h-4 text-gray-400 shrink-0 cursor-pointer" onClick={() => setZoom((z) => Math.max(1, z - 0.1))} />
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
                <ZoomIn className="w-4 h-4 text-gray-400 shrink-0 cursor-pointer" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} />
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
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-60 transition-colors duration-150 active:scale-[0.98]',
                )}
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
