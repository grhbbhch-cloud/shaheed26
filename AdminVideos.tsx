import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Cpu, Edit3, Film, Trash2, Upload, X } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { VideoThumbnailSelector } from '../../../components/admin/VideoThumbnailSelector';
import { useAdmin } from '../../../context/AdminContext';
import { usePlatform } from '../../../context/PlatformContext';
import { formatBytes, formatDuration } from '../../../lib/styleEngine';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { MediaFileRecord } from '../../../types/platform';

export function AdminVideos() {
  const { mediaFiles, content, pages, settings, refreshAll, notify, setActiveSection } = useAdmin();
  const { refreshBootstrap } = usePlatform();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [pollingIds, setPollingIds] = useState<number[]>([]);
  const [quickShowOfficialAccount, setQuickShowOfficialAccount] = useState<boolean>(false);
  const [deleteConflict, setDeleteConflict] = useState<{
    id: number;
    name: string;
    message: string;
    references: Array<{ kind: string; id: number | string; title: string; location: string }>;
  } | null>(null);
  const autoExtractedRef = useRef<Set<number>>(new Set());

  const videoFiles = mediaFiles.filter((m) => m.media_kind === 'video');
  const videoContent = content.filter((c) => c.content_type === 'video');
  const selectedVideo = videoFiles.find((v) => v.id === selectedVideoId) || null;

  // Live polling for active background transcoding jobs
  useEffect(() => {
    const activeProcessing = videoFiles.filter((v) => v.status === 'processing').map((v) => v.id);
    const allTracked = Array.from(new Set([...pollingIds, ...activeProcessing]));
    if (allTracked.length === 0) return;

    const timer = window.setInterval(async () => {
      let anyStillProcessing = false;
      for (const id of allTracked) {
        const res = await fetch(`/api/admin/media/${id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.file?.status === 'processing') {
            anyStillProcessing = true;
          } else {
            setPollingIds((prev) => prev.filter((x) => x !== id));
          }
        }
      }
      await refreshAll();
      if (!anyStillProcessing && activeProcessing.length === 0) {
        setPollingIds([]);
      }
    }, 2200);

    return () => window.clearInterval(timer);
  }, [pollingIds, videoFiles.map((v) => `${v.id}:${v.status}`).join(',')]);

  const retryThumbnails = async (media: MediaFileRecord) => {
    setBusyId(media.id);
    try {
      const res = await fetch(`/api/admin/media/${media.id}/extract-thumbnails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: 'spread', count: 6 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل استخراج الصور المصغرة');
      await refreshAll();
      notify(data.warning || `تم استخراج ${data.frames?.length || 0} صور مصغرة بنجاح`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر استخراج الصور المصغرة', 'error');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (!selectedVideo || busyId === selectedVideo.id) return;
    if (autoExtractedRef.current.has(selectedVideo.id)) return;
    let parsed: Array<{ isCustom?: boolean }> = [];
    try {
      parsed = JSON.parse(selectedVideo.thumbnails_json || '[]');
    } catch {
      parsed = [];
    }
    const extractedCount = parsed.filter((t) => !t.isCustom).length;
    if (extractedCount < 6) {
      autoExtractedRef.current.add(selectedVideo.id);
      retryThumbnails(selectedVideo);
    }
  }, [selectedVideo?.id]);

  const triggerTranscode = async (media: MediaFileRecord) => {
    setBusyId(media.id);
    try {
      const res = await fetch(`/api/admin/media/${media.id}/transcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('فشل بدء معالجة الجودات');
      setPollingIds((prev) => [...prev, media.id]);
      await refreshAll();
      notify('بدأت معالجة جودات التشغيل الفعلية عبر FFmpeg في الخلفية');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر المعالجة', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const assignThumbToContent = async (mediaId: number, thumbUrl: string) => {
    setBusyId(mediaId);
    try {
      const selRes = await fetch(`/api/admin/media/${mediaId}/select-thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: thumbUrl, applyToLinkedContent: true }),
      });
      if (!selRes.ok) {
        const err = await selRes.json().catch(() => ({}));
        throw new Error(err.error || 'تعذر حفظ الصورة المصغرة المختارة');
      }

      const linked = videoContent.filter((c) => c.media_file_id === mediaId);
      await refreshAll();
      await refreshBootstrap();
      notify(
        linked.length > 0
          ? 'تم حفظ وتطبيق الصورة المصغرة المختارة على الفيديو في الموقع العام'
          : 'تم حفظ الصورة المصغرة المختارة بنجاح لهذا الفيديو'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل حفظ الصورة المصغرة', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const createLinkedVideoContent = async (media: MediaFileRecord, thumbUrl: string) => {
    setBusyId(media.id);
    try {
      const homePg = pages.find((p) => p.page_type === 'home' || p.slug === 'home');
      const firstPage = pages.find((p) => p.slug === 'videos') || pages.find((p) => p.page_type !== 'home') || pages[0];
      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: media.original_name.replace(/\.[^.]+$/, '') || 'فيديو جديد',
          content_type: 'video',
          status: 'published',
          page_id: firstPage?.id || null,
          extra_page_ids: homePg ? [homePg.id] : [],
          media_file_id: media.id,
          media_url: media.public_url,
          thumbnail_url: thumbUrl,
          duration: media.duration || 0,
          resolution: media.height ? `${media.height}p` : '',
          settings: quickShowOfficialAccount ? { showOfficialAccount: true } : {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.item?.id) throw new Error(data.error || 'تعذر إنشاء مادة الفيديو');
      await refreshAll();
      await refreshBootstrap();
      notify('تم نشر مادة الفيديو مع الصورة المصغرة المختارة على الموقع العام');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر نشر الفيديو', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickVideoUpload = async (file: File) => {
    try {
      const res = await uploadFileInChunks(file);
      await refreshAll();
      setSelectedVideoId(res.media.id);
      notify(res.thumbnailWarning || 'تم رفع الفيديو واستخراج الصور المصغرة بنجاح');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الفيديو', 'error');
    }
  };

  const deleteMedia = async (id: number, name = '', force = false) => {
    const res = await fetch(`/api/admin/media/${id}${force ? '?force=1' : ''}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.inUse) {
      setDeleteConflict({
        id,
        name,
        message: data.error || 'ملف الفيديو مرتبط بمواد منشورة حالياً.',
        references: Array.isArray(data.references) ? data.references : [],
      });
      return;
    }
    if (!res.ok) {
      notify(data.error || 'تعذر حذف ملف الفيديو', 'error');
      return;
    }
    setDeleteConflict(null);
    if (selectedVideoId === id) setSelectedVideoId(null);
    await refreshAll();
    notify('تم حذف ملف الفيديو');
  };

  return (
    <div>
      <AdminPanelHeader
        title="مكتبة الفيديوهات والمعالجة"
        subtitle="إدارة ملفات الفيديو، معاينة واختيار الـ 6 صور مصغرة الحقيقية عبر FFmpeg أو رفع غلاف مخصص، وتوليد جودات التشغيل الفعلية (144p–1080p)."
        actions={
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer">
              <Upload size={14} />
              <span>رفع فيديو جديد</span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleQuickVideoUpload(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setActiveSection('uploads')}
              className="px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
            >
              مركز الرفع والنشر
            </button>
          </div>
        }
      />

      {videoFiles.length === 0 ? (
        <AdminCard>
          <div className="py-16 text-center space-y-3">
            <Film size={32} className="mx-auto text-neutral-400" />
            <p className="text-sm text-neutral-600">لا توجد ملفات فيديو مرفوعة بعد.</p>
          </div>
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-5 space-y-3">
            {videoFiles.map((vf) => {
              const thumbs: any[] = JSON.parse(vf.thumbnails_json || '[]');
              const rends: any[] = JSON.parse(vf.renditions_json || '[]');
              const linked = videoContent.find((c) => c.media_file_id === vf.id);
              return (
                <div
                  key={vf.id}
                  onClick={() => setSelectedVideoId(vf.id)}
                  className={`rounded-xl border p-3.5 bg-white cursor-pointer transition-all ${
                    selectedVideoId === vf.id ? 'border-[#B08D45] ring-2 ring-[#B08D45]/25' : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-24 aspect-video rounded-lg overflow-hidden bg-neutral-900 shrink-0">
                      {(linked?.thumbnail_url || thumbs.find((t) => t.selected)?.url || thumbs[0]?.url) ? (
                        <img
                          src={linked?.thumbnail_url || thumbs.find((t) => t.selected)?.url || thumbs[0]?.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-500">
                          <Film size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-neutral-900 truncate">{vf.original_name}</div>
                      <div className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                        {vf.width}×{vf.height} · {formatDuration(vf.duration)} · {formatBytes(vf.file_size)}
                      </div>
                      <div className="text-[11px] text-[#8C6A2F] mt-0.5 tabular-nums">
                        {thumbs.length} صور مصغرة · {rends.length} جودات ·{' '}
                        {vf.status === 'processing'
                          ? `جاري المعالجة (${vf.processing_progress}%)`
                          : vf.status === 'failed'
                            ? 'فشلت المعالجة'
                            : 'جاهز'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMedia(vf.id, vf.original_name, false);
                      }}
                      className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="xl:col-span-7">
            {selectedVideo ? (
              <AdminCard
                title={selectedVideo.original_name}
                subtitle={`الدقة الأصلية: ${selectedVideo.width}×${selectedVideo.height} · المدة: ${formatDuration(selectedVideo.duration)}`}
              >
                {(() => {
                  const thumbs: Array<{ index: number; timestamp: number; url: string; selected?: boolean; isCustom?: boolean }> = JSON.parse(
                    selectedVideo.thumbnails_json || '[]'
                  );
                  const rends: Array<{ label: string; height: number; url: string; fileSize: number }> =
                    JSON.parse(selectedVideo.renditions_json || '[]');
                  const linked = videoContent.find((c) => c.media_file_id === selectedVideo.id);
                  const currentThumb =
                    linked?.thumbnail_url ||
                    thumbs.find((t) => t.selected)?.url ||
                    thumbs[0]?.url ||
                    '';

                  return (
                    <div className="space-y-6">
                      <video
                        src={selectedVideo.public_url}
                        poster={currentThumb || undefined}
                        controls
                        className="w-full rounded-xl bg-black max-h-80"
                      />

                      {/* Real Automatic Frame Extraction & Thumbnail Selection Interface */}
                      <VideoThumbnailSelector
                        media={selectedVideo}
                        savedThumbnailUrl={currentThumb}
                        onConfirmThumbnail={async () => {
                          await refreshAll();
                          await refreshBootstrap();
                          notify('تم حفظ وتطبيق الصورة المصغرة المختارة بنجاح');
                        }}
                        onClearThumbnail={async () => {
                          await refreshAll();
                          await refreshBootstrap();
                        }}
                        onMediaUpdated={async () => {
                          await refreshAll();
                        }}
                        onNotify={notify}
                        onOpenLightbox={(url) => setLightboxUrl(url)}
                      />

                      {linked ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#F7F4EC] border border-[#E8E0D0] text-xs">
                          <span className="text-neutral-700 font-semibold">
                            مرتبط بمادة: {linked.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveSection('content')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
                          >
                            <Edit3 size={12} /> تعديل في إدارة المحتوى
                          </button>
                        </div>
                      ) : (
                        currentThumb && (
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-[#F7F4EC] border border-[#E8E0D0] text-xs">
                            <div className="space-y-1">
                              <div className="text-neutral-700 font-semibold">
                                هذا الفيديو غير منشور كمادة محتوى بعد.
                              </div>
                              {settings?.officialAccount?.enabled && !settings.officialAccount.deleted && (
                                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-neutral-800 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={quickShowOfficialAccount}
                                    onChange={(e) => setQuickShowOfficialAccount(e.target.checked)}
                                    className="accent-[#B08D45]"
                                  />
                                  <span>إظهار توثيق الحساب الرسمي ({settings.officialAccount.displayName})</span>
                                </label>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={busyId === selectedVideo.id}
                              onClick={() => createLinkedVideoContent(selectedVideo, currentThumb)}
                              className="px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
                            >
                              نشر الفيديو بالصورة المختارة الآن
                            </button>
                          </div>
                        )
                      )}

                      {/* Real FFmpeg Quality Renditions */}
                      <div className="pt-4 border-t border-neutral-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-neutral-900">
                              جودات التشغيل الفعلية (FFmpeg)
                            </h4>
                            <p className="text-[11px] text-neutral-500">
                              يتم توليد الجودات الأقل أو المساوية لدقة المصدر فقط ({selectedVideo.height}p).
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busyId === selectedVideo.id || selectedVideo.status === 'processing'}
                            onClick={() => triggerTranscode(selectedVideo)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer disabled:opacity-60"
                          >
                            <Cpu size={13} />
                            <span>
                              {selectedVideo.status === 'processing'
                                ? `جاري التحويل (${selectedVideo.processing_progress}%)`
                                : 'معالجة وتوليد الجودات'}
                            </span>
                          </button>
                        </div>

                        {selectedVideo.status === 'processing' && (
                          <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                            <div
                              className="h-full bg-[#B08D45] transition-all"
                              style={{ width: `${selectedVideo.processing_progress || 10}%` }}
                            />
                          </div>
                        )}
                        {selectedVideo.status === 'failed' && selectedVideo.error_message && (
                          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                            {selectedVideo.error_message}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rends.map((r, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-xs"
                            >
                              <span className="font-bold text-neutral-900">{r.label}</span>
                              <span className="text-neutral-500 tabular-nums">{formatBytes(r.fileSize)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </AdminCard>
            ) : (
              <AdminCard>
                <div className="py-20 text-center text-xs text-neutral-500">
                  اختر فيديو من القائمة لعرض إطاراته الستة المستخرجة وإدارة جوداته.
                </div>
              </AdminCard>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal with Prev/Next + Confirm Selection */}
      {lightboxUrl && selectedVideo && (() => {
        const thumbs: Array<{ index?: number; timestamp: number; url: string; isCustom?: boolean }> = JSON.parse(
          selectedVideo.thumbnails_json || '[]'
        );
        const currentIdx = thumbs.findIndex((t) => t.url === lightboxUrl);
        const cur = currentIdx >= 0 ? thumbs[currentIdx] : null;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <div
              className="relative max-w-4xl w-full bg-neutral-950 rounded-2xl overflow-hidden border border-white/15 p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-white">
                <div className="text-xs font-bold tabular-nums">
                  {cur
                    ? cur.isCustom
                      ? 'غلاف مخصص'
                      : `إطار #${cur.index || currentIdx + 1} من ${thumbs.length} — الثانية ${cur.timestamp}s`
                    : 'معاينة الصورة المصغرة'}
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxUrl(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative flex items-center justify-center bg-black rounded-xl overflow-hidden">
                <img src={lightboxUrl} alt="" className="w-full max-h-[72vh] object-contain" />
                {thumbs.length > 1 && currentIdx >= 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxUrl(thumbs[(currentIdx - 1 + thumbs.length) % thumbs.length].url)
                      }
                      className="absolute right-3 p-2 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(thumbs[(currentIdx + 1) % thumbs.length].url)}
                      className="absolute left-3 p-2 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer"
                    >
                      <ChevronLeft size={20} />
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    assignThumbToContent(selectedVideo.id, lightboxUrl);
                    setLightboxUrl(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
                >
                  <Check size={14} />
                  <span>اختيار واعتماد هذه الصورة المصغرة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxUrl(null)}
                  className="px-4 py-2 rounded-lg border border-white/20 text-white text-xs font-semibold hover:bg-white/10 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {deleteConflict && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setDeleteConflict(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                <AlertTriangle size={18} />
                <span>تحذير: الفيديو مرتبط بمحتوى منشور</span>
              </div>
              <button type="button" onClick={() => setDeleteConflict(null)} className="cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-neutral-700 space-y-2">
              <p className="font-semibold">{deleteConflict.message}</p>
              {deleteConflict.name && <p className="text-neutral-500">الملف: {deleteConflict.name}</p>}
              {deleteConflict.references.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {deleteConflict.references.map((r, i) => (
                    <div key={i} className="text-[11px] flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-800">{r.title}</span>
                      <span className="text-neutral-500">{r.location}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConflict(null)}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => deleteMedia(deleteConflict.id, deleteConflict.name, true)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer"
              >
                تأكيد الحذف رغم الارتباط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
