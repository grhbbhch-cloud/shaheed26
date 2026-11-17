import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Film,
  Maximize2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { captureFramesInBrowser, formatTimestampLabel } from '../../lib/browserVideoThumb';
import { uploadFileInChunks } from '../../lib/uploadClient';
import type { MediaFileRecord } from '../../types/platform';

export interface ThumbnailCandidate {
  index?: number;
  timestamp: number;
  url: string;
  width?: number;
  height?: number;
  selected?: boolean;
  isCustom?: boolean;
}

interface VideoThumbnailSelectorProps {
  media: MediaFileRecord;
  savedThumbnailUrl: string;
  onConfirmThumbnail: (url: string, updatedMedia?: MediaFileRecord) => void | Promise<void>;
  onClearThumbnail?: (updatedMedia?: MediaFileRecord) => void | Promise<void>;
  onMediaUpdated?: (updatedMedia: MediaFileRecord) => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenLightbox?: (url: string) => void;
}

export function VideoThumbnailSelector({
  media,
  savedThumbnailUrl,
  onConfirmThumbnail,
  onClearThumbnail,
  onMediaUpdated,
  onNotify,
  onOpenLightbox,
}: VideoThumbnailSelectorProps) {
  const [frames, setFrames] = useState<ThumbnailCandidate[]>(() => {
    try {
      const parsed = JSON.parse(media.thumbnails_json || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [stagedUrl, setStagedUrl] = useState<string>(savedThumbnailUrl || '');
  const [extractMode, setExtractMode] = useState<'spread' | 'interval'>('spread');
  const [frameCount, setFrameCount] = useState<number>(6);
  const [intervalSec, setIntervalSec] = useState<string>('2');
  const [customTs, setCustomTs] = useState<string>('1');
  const [busy, setBusy] = useState<boolean>(false);
  const [savingSelection, setSavingSelection] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');

  // Sync frames when selected media ID or media thumbnails JSON updates externally
  useEffect(() => {
    let parsed: ThumbnailCandidate[] = [];
    try {
      const raw = JSON.parse(media.thumbnails_json || '[]');
      parsed = Array.isArray(raw) ? raw : [];
    } catch {
      parsed = [];
    }
    setFrames(parsed);
  }, [media.id, media.thumbnails_json]);

  useEffect(() => {
    setStagedUrl(
      savedThumbnailUrl ||
        frames.find((f) => f.selected)?.url ||
        frames[0]?.url ||
        ''
    );
    setErrorMsg('');
  }, [media.id, savedThumbnailUrl]);

  const stagedFrame = frames.find((f) => f.url === stagedUrl) || null;
  const hasUnconfirmedSelection = Boolean(stagedUrl && stagedUrl !== savedThumbnailUrl);

  const runExtraction = async (modeOverride?: 'spread' | 'interval' | 'append') => {
    const mode = modeOverride || extractMode;
    setBusy(true);
    setErrorMsg('');
    setStatusNote('');

    try {
      const bodyPayload: Record<string, any> = {
        mode,
        count: mode === 'append' ? 4 : frameCount,
      };
      if (mode === 'interval') {
        const secVal = Number(intervalSec);
        if (!Number.isFinite(secVal) || secVal < 0.5) {
          throw new Error('الفاصل الزمني يجب أن لا يقل عن 0.5 ثانية');
        }
        bodyPayload.intervalSec = secVal;
      }

      const res = await fetch(`/api/admin/media/${media.id}/extract-thumbnails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Attempt real browser canvas fallback if FFmpeg server extraction failed & not append-only
        if (media.public_url) {
          try {
            const browserFrames = await captureFramesInBrowser(media.public_url, {
              mode: mode === 'interval' ? 'interval' : 'spread',
              count: mode === 'append' ? 3 : Math.min(frameCount, 6),
              intervalSec: Number(intervalSec || 2),
              durationHint: media.duration,
            });
            if (browserFrames.length > 0) {
              let latestMedia = media;
              let latestFrames: ThumbnailCandidate[] = [];
              for (let i = 0; i < browserFrames.length; i++) {
                const bf = browserFrames[i];
                const file = new File([bf.blob], `browser_frame_${Math.round(bf.timestamp * 100)}.jpg`, {
                  type: 'image/jpeg',
                });
                const up = await uploadFileInChunks(file);
                const reg = await fetch(`/api/admin/media/${media.id}/custom-thumbnail`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ url: up.media.public_url, applyToLinkedContent: i === 0 }),
                });
                if (reg.ok) {
                  const regData = await reg.json();
                  latestMedia = regData.file || latestMedia;
                  latestFrames = regData.frames || latestFrames;
                }
              }
              if (latestFrames.length > 0) {
                setFrames(latestFrames);
                onMediaUpdated?.(latestMedia);
                setStatusNote(`تم التقاط ${latestFrames.length} إطارات حقيقية عبر فك التشفير في المتصفح.`);
                onNotify?.(`تم استخراج ${latestFrames.length} إطارات عبر المتصفح`);
                return;
              }
            }
          } catch {
            // Fall through to report original error accurately
          }
        }
        throw new Error(data.error || data.warning || 'تعذر استخراج الصور المصغرة من الفيديو.');
      }

      const nextFrames: ThumbnailCandidate[] = Array.isArray(data.frames) ? data.frames : [];
      if (nextFrames.length === 0) {
        throw new Error('لم يتمكن الخادم من استخراج أي إطار صالح من هذا الفيديو.');
      }
      setFrames(nextFrames);
      if (data.file) onMediaUpdated?.(data.file);
      if (!stagedUrl || !nextFrames.some((f) => f.url === stagedUrl)) {
        const preferred = nextFrames.find((f) => f.selected)?.url || nextFrames[0].url;
        setStagedUrl(preferred);
      }
      const msg =
        data.warning ||
        (mode === 'append'
          ? `تم استخراج ${data.newlyAdded?.length || 0} إطارات إضافية بنجاح.`
          : `تم استخراج ${nextFrames.length} إطاراً من الفيديو بنجاح.`);
      setStatusNote(msg);
      onNotify?.(msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء استخراج إطارات الفيديو';
      setErrorMsg(msg);
      onNotify?.(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCaptureTimestamp = async () => {
    const ts = Number(customTs);
    if (!Number.isFinite(ts) || ts < 0) {
      setErrorMsg('أدخل توقيتاً صحيحاً بالثواني (0 أو أكبر).');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/media/${media.id}/extract-frame-at`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ timestamp: ts }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر التقاط إطار عند هذا التوقيت');
      const nextFrames: ThumbnailCandidate[] = Array.isArray(data.frames) ? data.frames : [];
      setFrames(nextFrames);
      if (data.file) onMediaUpdated?.(data.file);
      if (data.frame?.url) {
        setStagedUrl(data.frame.url);
      }
      setStatusNote(`تم التقاط إطار عند التوقيت ${ts}s وتجهيزه للمعاينة.`);
      onNotify?.(`تم التقاط إطار عند الثانية ${ts}s`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل التقاط الإطار المخصص';
      setErrorMsg(msg);
      onNotify?.(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSelection = async () => {
    if (!stagedUrl) return;
    setSavingSelection(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/media/${media.id}/select-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: stagedUrl, applyToLinkedContent: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر حفظ الصورة المصغرة المختارة');
      if (Array.isArray(data.frames)) setFrames(data.frames);
      if (data.file) onMediaUpdated?.(data.file);
      await onConfirmThumbnail(stagedUrl, data.file);
      setStatusNote('تم اعتماد وحفظ الصورة المصغرة المختارة بنجاح.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ الصورة المصغرة';
      setErrorMsg(msg);
      onNotify?.(msg, 'error');
    } finally {
      setSavingSelection(false);
    }
  };

  const handleCancelSelection = () => {
    setStagedUrl(savedThumbnailUrl || '');
    setStatusNote('تم إلغاء المعاينة المؤقتة والعودة للصورة المصغرة المحفوظة.');
  };

  const handleUploadCustom = async (file: File) => {
    setBusy(true);
    setErrorMsg('');
    try {
      const up = await uploadFileInChunks(file);
      const res = await fetch(`/api/admin/media/${media.id}/custom-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: up.media.public_url, applyToLinkedContent: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر حفظ الصورة المخصصة');
      if (Array.isArray(data.frames)) setFrames(data.frames);
      if (data.file) onMediaUpdated?.(data.file);
      setStagedUrl(up.media.public_url);
      await onConfirmThumbnail(up.media.public_url, data.file);
      setStatusNote('تم رفع واعتماد صورة الغلاف المخصصة.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل رفع الصورة المخصصة';
      setErrorMsg(msg);
      onNotify?.(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveSingleFrame = async (urlToRemove: string) => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/media/${media.id}/thumbnail`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: urlToRemove }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر حذف الإطار');
      const nextFrames: ThumbnailCandidate[] = Array.isArray(data.frames) ? data.frames : [];
      setFrames(nextFrames);
      if (data.file) onMediaUpdated?.(data.file);
      if (stagedUrl === urlToRemove) {
        const nextUrl = nextFrames.find((f) => f.selected)?.url || nextFrames[0]?.url || '';
        setStagedUrl(nextUrl);
      }
      if (savedThumbnailUrl === urlToRemove) {
        const fallbackUrl = nextFrames.find((f) => f.selected)?.url || nextFrames[0]?.url || '';
        if (fallbackUrl) {
          await onConfirmThumbnail(fallbackUrl, data.file);
        } else {
          await onClearThumbnail?.(data.file);
        }
      }
      onNotify?.('تم حذف الإطار من القائمة');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل حذف الإطار');
    } finally {
      setBusy(false);
    }
  };

  const handleClearAllThumbnails = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/media/${media.id}/thumbnail?all=1`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر مسح الصورة المصغرة');
      setFrames([]);
      setStagedUrl('');
      if (data.file) onMediaUpdated?.(data.file);
      await onClearThumbnail?.(data.file);
      setStatusNote('تم مسح الصورة المصغرة الحالية مع الإبقاء على ملف الفيديو الأصلي كما هو.');
      onNotify?.('تمت إزالة الصورة المصغرة دون المساس بالفيديو');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حذف الصورة المصغرة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-[#E8E0D0] bg-[#FAF8F4] p-4">
      {/* Header & Main Extraction Options */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E0D0]">
        <div>
          <h4 className="text-xs font-extrabold text-neutral-900 flex items-center gap-1.5">
            <Film size={14} className="text-[#8C6A2F]" />
            <span>استخراج واختيار الصورة المصغرة الحقيقية من الفيديو ({frames.length})</span>
          </h4>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            اختر الإطار المناسب لمعاينته بحجم كبير، ثم اضغط اعتماد وحفظ الصورة المصغرة لتطبيقه في الموقع.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#8C6A2F] border border-[#B08D45]/40 text-xs font-bold cursor-pointer hover:bg-[#F7F4EC]">
            <Upload size={13} />
            <span>رفع غلاف مخصص</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadCustom(f);
              }}
            />
          </label>
          {(frames.length > 0 || savedThumbnailUrl) && (
            <button
              type="button"
              disabled={busy}
              onClick={handleClearAllThumbnails}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-xs font-semibold hover:bg-red-50 cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={12} />
              <span>حذف الصورة المصغرة</span>
            </button>
          )}
        </div>
      </div>

      {/* Extraction Controls Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end bg-white p-3 rounded-xl border border-neutral-200">
        <div className="lg:col-span-4 space-y-1">
          <label className="block text-[11px] font-bold text-neutral-700">طريقة استخراج الإطارات</label>
          <select
            value={extractMode}
            onChange={(e) => setExtractMode(e.target.value as 'spread' | 'interval')}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
          >
            <option value="spread">توزيع شامل (البداية والمنتصف والنهاية)</option>
            <option value="interval">فاصل زمني مخصص كل (N) ثانية</option>
          </select>
        </div>

        <div className="lg:col-span-2 space-y-1">
          <label className="block text-[11px] font-bold text-neutral-700">عدد الإطارات</label>
          <select
            value={frameCount}
            onChange={(e) => setFrameCount(Number(e.target.value))}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
          >
            <option value={3}>3 إطارات</option>
            <option value={6}>6 إطارات</option>
            <option value={9}>9 إطارات</option>
            <option value={12}>12 إطاراً</option>
          </select>
        </div>

        {extractMode === 'interval' && (
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-neutral-700">كل كم ثانية؟</label>
            <input
              type="number"
              min={0.5}
              max={300}
              step={0.5}
              value={intervalSec}
              onChange={(e) => setIntervalSec(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
            />
          </div>
        )}

        <div className={`${extractMode === 'interval' ? 'lg:col-span-4' : 'lg:col-span-6'} flex flex-wrap items-center gap-2`}>
          <button
            type="button"
            disabled={busy}
            onClick={() => runExtraction(extractMode)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            <span>{frames.length > 0 ? 'إعادة توليد الإطارات' : 'استخراج الإطارات الآن'}</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => runExtraction('append')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-800 text-xs font-bold hover:bg-neutral-50 disabled:opacity-60 cursor-pointer"
          >
            <Plus size={13} />
            <span>استخراج إطارات إضافية</span>
          </button>
        </div>
      </div>

      {/* Specific Timestamp Capture */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-neutral-200 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Camera size={14} className="text-[#8C6A2F]" />
          <span className="font-bold text-neutral-700">التقاط إطار من توقيت محدد (بالثواني):</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={customTs}
            onChange={(e) => setCustomTs(e.target.value)}
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-xs tabular-nums"
          />
          <button
            type="button"
            disabled={busy}
            onClick={handleCaptureTimestamp}
            className="px-3 py-1 rounded-lg bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
          >
            التقاط هذا الإطار
          </button>
        </div>
        {media.duration > 0 && (
          <span className="text-[11px] text-neutral-500 tabular-nums">
            مدة الفيديو: {formatTimestampLabel(media.duration)} ({media.duration.toFixed(1)}s)
          </span>
        )}
      </div>

      {/* Meaningful Error + Retry */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-red-700 font-semibold">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => runExtraction(extractMode)}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {statusNote && !errorMsg && (
        <div className="px-3 py-2 rounded-lg bg-[#F7F4EC] border border-[#B08D45]/30 text-[11px] font-semibold text-[#8C6A2F]">
          {statusNote}
        </div>
      )}

      {/* Large Preview of Currently Staged/Selected Frame */}
      {stagedUrl && (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
            <div className="md:col-span-7 bg-black relative flex items-center justify-center">
              <img
                src={stagedUrl}
                alt="معاينة الصورة المصغرة المحددة"
                className="w-full aspect-video object-contain max-h-64"
              />
              {onOpenLightbox && (
                <button
                  type="button"
                  onClick={() => onOpenLightbox(stagedUrl)}
                  title="تكبير الإطار"
                  className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-black/70 text-white hover:bg-black cursor-pointer"
                >
                  <Maximize2 size={14} />
                </button>
              )}
            </div>

            <div className="md:col-span-5 p-4 flex flex-col justify-between gap-3">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-neutral-900">
                  {hasUnconfirmedSelection ? (
                    <span className="text-amber-700">معاينة الإطار المحدد (بانتظار الاعتماد)</span>
                  ) : (
                    <>
                      <CheckCircle2 size={14} className="text-[#8C6A2F]" />
                      <span className="text-[#8C6A2F]">الصورة المصغرة المعتمدة حالياً</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-neutral-600 tabular-nums space-y-0.5">
                  {stagedFrame ? (
                    <>
                      <div>
                        التوقيت:{' '}
                        {stagedFrame.isCustom && stagedFrame.timestamp === 0
                          ? 'غلاف مخصص'
                          : `${formatTimestampLabel(stagedFrame.timestamp)} (${stagedFrame.timestamp}s)`}
                      </div>
                      {stagedFrame.width && stagedFrame.height && (
                        <div>
                          أبعاد الإطار: {stagedFrame.width}×{stagedFrame.height}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="truncate" dir="ltr">
                      {stagedUrl}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  disabled={savingSelection || !stagedUrl}
                  onClick={handleConfirmSelection}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] disabled:opacity-60 cursor-pointer"
                >
                  <Check size={14} />
                  <span>{savingSelection ? 'جاري الحفظ...' : 'اعتماد وحفظ الصورة المصغرة'}</span>
                </button>
                {hasUnconfirmedSelection && (
                  <button
                    type="button"
                    onClick={handleCancelSelection}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
                  >
                    <X size={13} />
                    <span>إلغاء</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Frames Grid */}
      {frames.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {frames.map((th, idx) => {
            const isStaged = stagedUrl === th.url;
            const isSaved = savedThumbnailUrl === th.url;
            const frameNum = th.index || idx + 1;
            return (
              <div
                key={`${th.url}-${idx}`}
                className={`relative rounded-xl overflow-hidden border-2 bg-white transition-all ${
                  isStaged
                    ? 'border-[#B08D45] ring-2 ring-[#B08D45]/35'
                    : isSaved
                      ? 'border-emerald-600'
                      : 'border-neutral-200 hover:border-neutral-400'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setStagedUrl(th.url)}
                  className="w-full text-right block cursor-pointer"
                >
                  <img
                    src={th.url}
                    alt={`إطار ${frameNum}`}
                    className="aspect-video w-full object-cover bg-neutral-900"
                  />
                  <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                    <span className="tabular-nums text-neutral-700 font-semibold">
                      {th.isCustom && th.timestamp === 0
                        ? 'مخصص'
                        : `#${frameNum} · ${formatTimestampLabel(th.timestamp)}`}
                    </span>
                    {isSaved ? (
                      <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                        <Check size={11} /> معتمد
                      </span>
                    ) : isStaged ? (
                      <span className="text-[#8C6A2F] font-bold">محدد</span>
                    ) : null}
                  </div>
                </button>

                <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                  {onOpenLightbox && (
                    <button
                      type="button"
                      onClick={() => onOpenLightbox(th.url)}
                      title="معاينة بالحجم الكامل"
                      className="p-1.5 rounded bg-black/70 text-white hover:bg-black cursor-pointer"
                    >
                      <Maximize2 size={11} />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRemoveSingleFrame(th.url)}
                    title="حذف هذا الإطار"
                    className="p-1.5 rounded bg-black/70 text-red-300 hover:bg-red-700 hover:text-white cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-white border border-dashed border-neutral-300 text-center space-y-2">
          <p className="text-xs text-neutral-600 font-semibold">
            {busy
              ? 'جاري تحليل وفك تشفير الفيديو لاستخراج الإطارات الحقيقية...'
              : 'لا توجد إطارات مستخرجة بعد لهذا الفيديو.'}
          </p>
          {!busy && (
            <button
              type="button"
              onClick={() => runExtraction(extractMode)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>استخراج الإطارات الآن</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
