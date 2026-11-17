import type { MediaFileRecord } from '../types/platform';

export interface UploadProgressInfo {
  phase: 'hashing' | 'init' | 'uploading' | 'finalizing' | 'done' | 'error';
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  sessionId?: string;
  speedBytesPerSec?: number;
  remainingBytes?: number;
  etaSeconds?: number;
}

export interface UploadResult {
  media: MediaFileRecord;
  duplicate: boolean;
  thumbnailWarning: string;
}

async function computeFileSha256(file: File): Promise<string | undefined> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && file.size <= 150 * 1024 * 1024) {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback gracefully on large files or restricted contexts
  }
  return undefined;
}

export async function uploadFileInChunks(
  file: File,
  onProgress?: (info: UploadProgressInfo) => void,
  options?: { allowDuplicate?: boolean; signal?: AbortSignal; chunkSizeBytes?: number }
): Promise<UploadResult> {
  const chunkSize = options?.chunkSizeBytes || 2 * 1024 * 1024; // 2 MB chunks
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));

  onProgress?.({
    phase: 'hashing',
    percent: 0,
    uploadedBytes: 0,
    totalBytes: file.size,
    currentChunk: 0,
    totalChunks,
    speedBytesPerSec: 0,
    remainingBytes: file.size,
    etaSeconds: 0,
  });

  const sha256 = await computeFileSha256(file);

  onProgress?.({
    phase: 'init',
    percent: 1,
    uploadedBytes: 0,
    totalBytes: file.size,
    currentChunk: 0,
    totalChunks,
    speedBytesPerSec: 0,
    remainingBytes: file.size,
    etaSeconds: 0,
  });

  const initRes = await fetch('/api/admin/uploads/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    signal: options?.signal,
    body: JSON.stringify({
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalSize: file.size,
      totalChunks,
      sha256,
      allowDuplicate: Boolean(options?.allowDuplicate),
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تهيئة جلسة الرفع');
  }

  const initData = (await initRes.json()) as {
    duplicate: boolean;
    media?: MediaFileRecord;
    thumbnailWarning?: string;
    resumed?: boolean;
    sessionId?: string;
    receivedChunks?: number[];
  };

  if (initData.duplicate && initData.media) {
    onProgress?.({
      phase: 'done',
      percent: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      currentChunk: totalChunks,
      totalChunks,
      speedBytesPerSec: 0,
      remainingBytes: 0,
      etaSeconds: 0,
    });
    return {
      media: initData.media,
      duplicate: true,
      thumbnailWarning: initData.thumbnailWarning || '',
    };
  }

  const sessionId = initData.sessionId!;
  const alreadyReceived = new Set<number>(initData.receivedChunks || []);

  let uploadedBytes = 0;
  let networkBytesSent = 0;
  const uploadStartTime = Date.now();

  const calcMetrics = (sentNow: number) => {
    const elapsedSec = Math.max(0.2, (Date.now() - uploadStartTime) / 1000);
    const speedBytesPerSec = Math.round(sentNow / elapsedSec);
    const remainingBytes = Math.max(0, file.size - uploadedBytes);
    const etaSeconds = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;
    return { speedBytesPerSec, remainingBytes, etaSeconds };
  };

  for (let i = 0; i < totalChunks; i++) {
    if (options?.signal?.aborted) {
      throw new Error('تم إيقاف الرفع بواسطة المستخدم');
    }
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const slice = file.slice(start, end);

    if (alreadyReceived.has(i)) {
      uploadedBytes += slice.size;
      const pct = Math.min(96, Math.round((uploadedBytes / Math.max(1, file.size)) * 95));
      const metrics = calcMetrics(networkBytesSent);
      onProgress?.({
        phase: 'uploading',
        percent: pct,
        uploadedBytes,
        totalBytes: file.size,
        currentChunk: i + 1,
        totalChunks,
        sessionId,
        ...metrics,
      });
      continue;
    }

    let attempt = 0;
    let chunkOk = false;
    let lastErr: Error | null = null;
    while (attempt < 3 && !chunkOk) {
      attempt++;
      try {
        const res = await fetch(`/api/admin/uploads/${sessionId}/chunk/${i}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          credentials: 'include',
          signal: options?.signal,
          body: slice,
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || `فشل رفع الجزء ${i + 1}`);
        }
        chunkOk = true;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (options?.signal?.aborted) throw lastErr;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
        }
      }
    }
    if (!chunkOk) {
      throw lastErr || new Error(`فشل رفع الجزء ${i + 1} بعد عدة محاولات`);
    }

    uploadedBytes += slice.size;
    networkBytesSent += slice.size;
    const pct = Math.min(96, Math.max(2, Math.round((uploadedBytes / Math.max(1, file.size)) * 95)));
    const metrics = calcMetrics(networkBytesSent);
    onProgress?.({
      phase: 'uploading',
      percent: pct,
      uploadedBytes,
      totalBytes: file.size,
      currentChunk: i + 1,
      totalChunks,
      sessionId,
      ...metrics,
    });
  }

  onProgress?.({
    phase: 'finalizing',
    percent: 97,
    uploadedBytes: file.size,
    totalBytes: file.size,
    currentChunk: totalChunks,
    totalChunks,
    sessionId,
    speedBytesPerSec: calcMetrics(networkBytesSent).speedBytesPerSec,
    remainingBytes: 0,
    etaSeconds: 0,
  });

  const completeRes = await fetch(`/api/admin/uploads/${sessionId}/complete`, {
    method: 'POST',
    credentials: 'include',
    signal: options?.signal,
  });
  if (!completeRes.ok) {
    const err = await completeRes.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تجميع ومعالجة الملف بعد الرفع');
  }

  const result = (await completeRes.json()) as UploadResult;
  onProgress?.({
    phase: 'done',
    percent: 100,
    uploadedBytes: file.size,
    totalBytes: file.size,
    currentChunk: totalChunks,
    totalChunks,
    sessionId,
    speedBytesPerSec: calcMetrics(networkBytesSent).speedBytesPerSec,
    remainingBytes: 0,
    etaSeconds: 0,
  });
  return result;
}
