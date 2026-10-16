import { create } from 'zustand';

export type ExcelDownloadStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExcelDownloadState {
  isOpen: boolean;
  status: ExcelDownloadStatus;
  title: string;
  filename: string;
  errorMessage: string | null;
  isDownloading: boolean;
  autoCloseTimer: NodeJS.Timeout | null;
  startDownload: (filename?: string, title?: string) => void;
  finishSuccess: (filename?: string, title?: string) => void;
  finishError: (errorMessage: string) => void;
  closePopup: () => void;
}

export const useExcelDownloadStore = create<ExcelDownloadState>((set, get) => ({
  isOpen: false,
  status: 'idle',
  title: 'Generating Excel Report...',
  filename: 'report.xlsx',
  errorMessage: null,
  isDownloading: false,
  autoCloseTimer: null,

  startDownload: (filename = 'report.xlsx', title = 'Generating Excel Report...') => {
    const prevTimer = get().autoCloseTimer;
    if (prevTimer) clearTimeout(prevTimer);

    set({
      isOpen: true,
      status: 'loading',
      title,
      filename,
      errorMessage: null,
      isDownloading: true,
      autoCloseTimer: null,
    });
  },

  finishSuccess: (filename, title = 'Excel Downloaded Successfully!') => {
    const prevTimer = get().autoCloseTimer;
    if (prevTimer) clearTimeout(prevTimer);

    const timer = setTimeout(() => {
      get().closePopup();
    }, 3000);

    set({
      isOpen: true,
      status: 'success',
      title,
      ...(filename ? { filename } : {}),
      errorMessage: null,
      isDownloading: false,
      autoCloseTimer: timer,
    });
  },

  finishError: (errorMessage: string) => {
    const prevTimer = get().autoCloseTimer;
    if (prevTimer) clearTimeout(prevTimer);

    set({
      isOpen: true,
      status: 'error',
      title: 'Download Failed',
      errorMessage,
      isDownloading: false,
      autoCloseTimer: null,
    });
  },

  closePopup: () => {
    const prevTimer = get().autoCloseTimer;
    if (prevTimer) clearTimeout(prevTimer);

    set({
      isOpen: false,
      status: 'idle',
      errorMessage: null,
      isDownloading: false,
      autoCloseTimer: null,
    });
  },
}));

/**
 * Universal helper that performs the server request, manages popup states,
 * triggers the browser file download, and handles errors.
 */
export async function executeExcelDownload(
  exportUrl: string,
  filename: string,
  title = 'Generating Excel Report...',
) {
  const store = useExcelDownloadStore.getState();
  if (store.isDownloading) {
    return;
  }

  store.startDownload(filename, title);

  try {
    const res = await fetch(exportUrl);
    if (!res.ok) {
      let errorMsg = 'Failed to generate Excel report';
      try {
        const data = await res.json();
        if (data?.error) errorMsg = data.error;
      } catch {
        errorMsg = `Server returned status ${res.status}: Failed to download report`;
      }
      throw new Error(errorMsg);
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 1000);

    store.finishSuccess(filename, 'Excel Downloaded Successfully!');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed';
    store.finishError(msg);
  }
}
