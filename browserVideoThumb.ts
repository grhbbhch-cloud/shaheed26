export function formatTimestampLabel(seconds: number): string {
  const s = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  const whole = Math.floor(rem);
  const tenths = Math.round((rem - whole) * 10);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths === 10 ? 9 : tenths}`;
}

export interface BrowserCapturedFrame {
  timestamp: number;
  blob: Blob;
  previewDataUrl: string;
  width: number;
  height: number;
}

/**
 * Real HTML5 <video> + <canvas> frame decoder fallback for browsers.
 * Reads and decodes the actual video URL at candidate timestamps.
 */
export async function captureFramesInBrowser(
  videoUrl: string,
  options: { mode?: 'spread' | 'interval'; count?: number; intervalSec?: number; durationHint?: number } = {}
): Promise<BrowserCapturedFrame[]> {
  if (!videoUrl || typeof document === 'undefined') {
    throw new Error('لا يمكن تهيئة فك تشفير الفيديو في المتصفح.');
  }

  const count = Math.max(1, Math.min(12, Number(options.count || 6)));
  const intervalSec = Math.max(0.5, Number(options.intervalSec || 2));

  return new Promise<BrowserCapturedFrame[]>((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      video.removeAttribute('src');
      video.load();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('انتهت مهلة فك تشفير الفيديو في المتصفح.'));
    }, 35000);

    video.onerror = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      reject(new Error('تعذر تحميل أو فك تشفير ملف الفيديو في المتصفح.'));
    };

    video.onloadedmetadata = async () => {
      try {
        const dur =
          Number.isFinite(video.duration) && video.duration > 0.2
            ? video.duration
            : Number(options.durationHint || 1);
        const maxSafe = Math.max(0, dur - 0.12);
        const timestamps: number[] = [];

        if (options.mode === 'interval') {
          const startAt = Math.min(maxSafe, Math.min(1, dur * 0.04));
          for (let i = 0; i < count; i++) {
            const t = startAt + i * intervalSec;
            if (t > maxSafe) break;
            timestamps.push(Number(t.toFixed(2)));
          }
          if (timestamps.length === 0) timestamps.push(Number(Math.min(maxSafe, dur * 0.1).toFixed(2)));
        } else {
          for (let i = 0; i < count; i++) {
            const pct = count === 1 ? 0.5 : 0.04 + ((0.92 - 0.04) * i) / (count - 1);
            timestamps.push(Number(Math.max(0, Math.min(maxSafe, dur * pct)).toFixed(2)));
          }
        }

        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 360;
        const targetW = Math.min(640, vw);
        const targetH = Math.max(120, Math.round((targetW * vh) / vw));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('تعذر تهيئة Canvas لالتقاط الإطار.');

        const out: BrowserCapturedFrame[] = [];
        for (const t of timestamps) {
          await new Promise<void>((resSeek, rejSeek) => {
            const seekTimeout = window.setTimeout(() => rejSeek(new Error('seek timeout')), 6000);
            const onSeeked = () => {
              window.clearTimeout(seekTimeout);
              video.removeEventListener('seeked', onSeeked);
              resSeek();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = t;
          });

          ctx.drawImage(video, 0, 0, targetW, targetH);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          const blob = await new Promise<Blob | null>((resBlob) => canvas.toBlob(resBlob, 'image/jpeg', 0.88));
          if (blob && blob.size > 200) {
            out.push({
              timestamp: t,
              blob,
              previewDataUrl: dataUrl,
              width: targetW,
              height: targetH,
            });
          }
        }

        window.clearTimeout(timeoutId);
        cleanup();
        if (out.length === 0) {
          reject(new Error('لم يتم التقاط أي إطار صالح من الفيديو.'));
          return;
        }
        resolve(out);
      } catch (err) {
        window.clearTimeout(timeoutId);
        cleanup();
        reject(err instanceof Error ? err : new Error('تعذر استخراج الإطارات في المتصفح.'));
      }
    };

    video.src = videoUrl;
  });
}
