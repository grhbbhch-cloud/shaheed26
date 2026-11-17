import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Globe, Monitor, Play, Plus, Smartphone, Star, Subtitles, Trash2, Upload } from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import type { AllSettings, SiteI18nConfig, SiteLanguageItem, SubtitleCue, SubtitleTrackRecord } from '../../../types/platform';

function parseSrtOrVtt(raw: string): SubtitleCue[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/^WEBVTT[^\n]*\n+/, '').trim();
  const blocks = normalized.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const blk of blocks) {
    const lines = blk.split('\n').map((l) => l.trim()).filter(Boolean);
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;
    const [startRaw, endRaw] = lines[timeIdx].split('-->').map((s) => s.trim().split(' ')[0]);
    const text = lines.slice(timeIdx + 1).join('\n');
    if (startRaw && endRaw && text) {
      cues.push({
        id: `cue-${Date.now()}-${Math.random()}`,
        start: startRaw.replace(',', '.'),
        end: endRaw.replace(',', '.'),
        text,
      });
    }
  }
  return cues;
}

function parseTsToSeconds(ts: string): number {
  const clean = String(ts || '').trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return Number(clean) || 0;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#000000').replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

export function AdminSubtitles() {
  const { content, settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const videos = content.filter((c) => c.content_type === 'video');

  const [tab, setTab] = useState<'subtitles' | 'i18n'>('subtitles');
  const [i18nCfg, setI18nCfg] = useState<SiteI18nConfig | null>(null);
  const [selectedLangIdx, setSelectedLangIdx] = useState<number>(0);
  const [savingI18n, setSavingI18n] = useState(false);

  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [tracks, setTracks] = useState<SubtitleTrackRecord[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<number | null>(null);
  const [subStyle, setSubStyle] = useState<AllSettings['subtitles'] | null>(null);
  const [savingStyle, setSavingStyle] = useState(false);

  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewCueText, setPreviewCueText] = useState<string>('معاينة نص الترجمة العربية على شاشة المشغل');
  const [videoTime, setVideoTime] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [trackForm, setTrackForm] = useState({
    language: 'ar',
    language_label: 'العربية',
    title: 'الترجمة العربية',
    status: 'published' as 'published' | 'draft' | 'hidden',
    is_default: false,
    cues: [{ id: 'c1', start: '00:00:00.000', end: '00:00:04.000', text: '' }] as SubtitleCue[],
  });

  useEffect(() => {
    if (settings?.subtitles) setSubStyle(JSON.parse(JSON.stringify(settings.subtitles)));
    if (settings?.i18n) setI18nCfg(structuredClone(settings.i18n));
  }, [settings?.subtitles, settings?.i18n]);

  useEffect(() => {
    if (!selectedVideoId && videos.length > 0) {
      setSelectedVideoId(String(videos[0].id));
    }
  }, [videos, selectedVideoId]);

  const selectedVideo = useMemo(
    () => videos.find((v) => String(v.id) === selectedVideoId) || null,
    [videos, selectedVideoId]
  );

  const loadTracks = async (vidId: string) => {
    if (!vidId) {
      setTracks([]);
      return;
    }
    const res = await fetch(`/api/admin/subtitles?contentId=${vidId}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setTracks(data.tracks || []);
    }
  };

  useEffect(() => {
    loadTracks(selectedVideoId);
  }, [selectedVideoId]);

  const selectTrack = (t: SubtitleTrackRecord) => {
    setActiveTrackId(t.id);
    let parsedCues: SubtitleCue[] = [];
    try {
      parsedCues = JSON.parse(t.cues_json || '[]');
    } catch {
      parsedCues = [];
    }
    setTrackForm({
      language: t.language,
      language_label: t.language_label,
      title: t.title,
      status: t.status,
      is_default: Boolean(t.is_default),
      cues: parsedCues,
    });
    if (parsedCues[0]?.text) {
      setPreviewCueText(parsedCues[0].text);
    }
  };

  const activeTimeCue = useMemo(() => {
    const match = trackForm.cues.find((c) => {
      const s = parseTsToSeconds(c.start);
      const e = parseTsToSeconds(c.end);
      return videoTime >= s && videoTime <= e && c.text.trim().length > 0;
    });
    return match?.text || '';
  }, [trackForm.cues, videoTime]);

  const displayedPreviewText =
    activeTimeCue ||
    trackForm.cues.find((c) => c.text.trim())?.text ||
    previewCueText ||
    'معاينة نص الترجمة العربية على شاشة المشغل';

  const saveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideoId) {
      notify('اختر فيديو أولاً', 'error');
      return;
    }
    const url = activeTrackId ? `/api/admin/subtitles/${activeTrackId}` : '/api/admin/subtitles';
    const method = activeTrackId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        content_id: Number(selectedVideoId),
        language: trackForm.language,
        language_label: trackForm.language_label,
        title: trackForm.title,
        status: trackForm.status,
        visible: trackForm.status === 'hidden' ? 0 : 1,
        is_default: trackForm.is_default ? 1 : 0,
        cues: trackForm.cues,
      }),
    });
    if (res.ok) {
      await loadTracks(selectedVideoId);
      notify('تم حفظ مسار الترجمة بنجاح');
    } else {
      const d = await res.json().catch(() => ({}));
      notify(d.error || 'تعذر حفظ مسار الترجمة', 'error');
    }
  };

  const setTrackAsDefault = async (trackId: number) => {
    const res = await fetch(`/api/admin/subtitles/${trackId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_default: 1 }),
    });
    if (res.ok) {
      await loadTracks(selectedVideoId);
      if (activeTrackId === trackId) {
        setTrackForm((prev) => ({ ...prev, is_default: true }));
      }
      notify('تم تعيين المسار كترجمة افتراضية');
    } else {
      notify('تعذر تعيين المسار الافتراضي', 'error');
    }
  };

  const moveCue = (idx: number, dir: -1 | 1) => {
    setTrackForm((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.cues.length) return prev;
      const next = [...prev.cues];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, cues: next };
    });
  };

  const exportVtt = () => {
    const lines = ['WEBVTT', ''];
    for (const c of trackForm.cues) {
      lines.push(`${c.start} --> ${c.end}`);
      lines.push(c.text);
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trackForm.language || 'subtitles'}.vtt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseSrtOrVtt(text);
    if (parsed.length === 0) {
      notify('لم يتم العثور على أسطر ترجمة صالحة في الملف', 'error');
      return;
    }
    setTrackForm((prev) => ({ ...prev, cues: parsed }));
    if (parsed[0]?.text) setPreviewCueText(parsed[0].text);
    notify(`تم استيراد ${parsed.length} سطر ترجمة`);
  };

  const previewCue = (cue: SubtitleCue) => {
    if (cue.text.trim()) setPreviewCueText(cue.text);
    const sec = parseTsToSeconds(cue.start);
    setVideoTime(sec);
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
    }
  };

  const I18N_OVERRIDE_KEYS: Array<{ key: string; label: string }> = [
    { key: 'homeEmptySection', label: 'رسالة القسم الفارغ بالرئيسية' },
    { key: 'viewAllDefaultLabel', label: 'نص زر عرض الكل' },
    { key: 'breadcrumbHome', label: 'الرابط الأول في مسار التنقل (Breadcrumb)' },
    { key: 'allItemsFilter', label: 'فلتر: الكل' },
    { key: 'allTypesFilter', label: 'فلتر: جميع الأنواع' },
    { key: 'sortNewest', label: 'فرز: الأحدث' },
    { key: 'sortOldest', label: 'فرز: الأقدم' },
    { key: 'backToHomeLabel', label: 'زر العودة للرئيسية' },
    { key: 'collectionEmptyMessage', label: 'رسالة عدم وجود محتوى بالقسم' },
    { key: 'searchHeading', label: 'عنوان صفحة البحث' },
    { key: 'downloadVideoLabel', label: 'زر تحميل الفيديو' },
    { key: 'downloadImageLabel', label: 'زر تحميل الصورة' },
    { key: 'shareLabel', label: 'زر المشاركة' },
    { key: 'copyLinkLabel', label: 'زر نسخ الرابط' },
    { key: 'copiedLinkLabel', label: 'رسالة تم النسخ' },
  ];

  const handleCancel = () => {
    if (tab === 'subtitles' && settings?.subtitles) {
      setSubStyle(JSON.parse(JSON.stringify(settings.subtitles)));
    } else if (tab === 'i18n' && settings?.i18n) {
      setI18nCfg(structuredClone(settings.i18n));
    }
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    if (tab === 'subtitles') {
      const prev = previousSettings.subtitles as AllSettings['subtitles'] | undefined;
      if (!prev) return;
      setSubStyle(structuredClone(prev));
    } else {
      const prev = previousSettings.i18n as SiteI18nConfig | undefined;
      if (!prev) return;
      setI18nCfg(structuredClone(prev));
    }
    notify('تمت استعادة الإعدادات السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges =
    tab === 'subtitles'
      ? Boolean(subStyle && settings?.subtitles && JSON.stringify(subStyle) !== JSON.stringify(settings.subtitles))
      : Boolean(i18nCfg && settings?.i18n && JSON.stringify(i18nCfg) !== JSON.stringify(settings.i18n));
  const hasPreviousSnapshot = Boolean(
    tab === 'subtitles' ? previousSettings.subtitles : previousSettings.i18n
  );

  return (
    <div>
      <AdminPanelHeader
        title="إدارة الترجمات ولغات واجهة الموقع"
        subtitle="إضافة وتعديل مسارات الترجمة الحقيقية لكل فيديو، وإدارة لغات واجهة الموقع العام واتجاهها (RTL/LTR) ونصوصها"
        onSave={
          tab === 'subtitles'
            ? subStyle
              ? async () => {
                  setSavingStyle(true);
                  await saveCategory('subtitles', subStyle, 'تحديث مظهر الترجمات');
                  setSavingStyle(false);
                }
              : undefined
            : i18nCfg
              ? async () => {
                  setSavingI18n(true);
                  await saveCategory('i18n', i18nCfg, 'تحديث لغات واجهة الموقع');
                  setSavingI18n(false);
                }
              : undefined
        }
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory(tab === 'subtitles' ? 'subtitles' : 'i18n')}
        saving={tab === 'subtitles' ? savingStyle : savingI18n}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setTab('subtitles')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            tab === 'subtitles'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          <Subtitles size={14} /> مسارات ومظهر الترجمة
        </button>
        <button
          type="button"
          onClick={() => setTab('i18n')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            tab === 'i18n'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          <Globe size={14} /> لغات واجهة الموقع ({i18nCfg?.languages?.length || 0})
        </button>
      </div>

      {tab === 'subtitles' ? (
      <div className="space-y-6">
        {/* Interactive Live Subtitle Preview */}
        {subStyle && (
          <AdminCard title="معاينة حية لمظهر الترجمة على الفيديو">
            <div className="flex items-center justify-end gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                  previewViewport === 'desktop'
                    ? 'bg-[#B08D45] text-white'
                    : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                <Monitor size={13} /> كمبيوتر
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                  previewViewport === 'mobile'
                    ? 'bg-[#B08D45] text-white'
                    : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                <Smartphone size={13} /> جوال
              </button>
            </div>
            <div className={previewViewport === 'mobile' ? 'max-w-sm mx-auto' : 'max-w-3xl mx-auto'}>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-[#0D100F] border border-neutral-800 shadow-lg">
                {selectedVideo?.media_url ? (
                  <video
                    ref={videoRef}
                    src={selectedVideo.media_url}
                    poster={selectedVideo.thumbnail_url || undefined}
                    controls
                    onTimeUpdate={(e) => setVideoTime(e.currentTarget.currentTime)}
                    className="w-full h-full object-contain"
                  />
                ) : selectedVideo?.thumbnail_url ? (
                  <img
                    src={selectedVideo.thumbnail_url}
                    alt={selectedVideo.title}
                    className="w-full h-full object-cover opacity-80"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                    شاشة معاينة الفيديو والترجمة
                  </div>
                )}

                <div
                  className="pointer-events-none absolute inset-x-0 flex justify-center px-4"
                  style={{
                    top: subStyle.position === 'top' ? `${subStyle.bottomMargin}px` : undefined,
                    bottom: subStyle.position !== 'top' ? `${subStyle.bottomMargin}px` : undefined,
                  }}
                >
                  <div
                    style={{
                      fontFamily: subStyle.fontFamily,
                      fontSize: `${previewViewport === 'mobile' ? subStyle.fontSizeMobile : subStyle.fontSizeDesktop}px`,
                      fontWeight: subStyle.fontWeight || '600',
                      color: subStyle.textColor,
                      backgroundColor: hexToRgba(subStyle.backgroundColor, subStyle.backgroundOpacity),
                      textShadow:
                        subStyle.textShadow ||
                        (subStyle.outlineWidth > 0
                          ? `0 0 ${subStyle.outlineWidth * 2}px ${subStyle.outlineColor}`
                          : '0 2px 4px rgba(0,0,0,0.85)'),
                      WebkitTextStroke:
                        subStyle.outlineWidth > 0
                          ? `${subStyle.outlineWidth}px ${subStyle.outlineColor}`
                          : undefined,
                      textAlign: subStyle.textAlign || 'center',
                      lineHeight: subStyle.lineSpacing || 1.45,
                      maxWidth: `${subStyle.maxWidthPercent || 85}%`,
                      padding: '6px 14px',
                      borderRadius: '6px',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {displayedPreviewText}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-neutral-700">نص اختبار المعاينة:</label>
                <input
                  type="text"
                  value={previewCueText}
                  onChange={(e) => setPreviewCueText(e.target.value)}
                  className="flex-1 min-w-[220px] rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </AdminCard>
        )}

        <AdminCard title="محرر مسارات الترجمة للفيديوهات">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">اختر الفيديو</label>
                <select
                  value={selectedVideoId}
                  onChange={(e) => {
                    setSelectedVideoId(e.target.value);
                    setActiveTrackId(null);
                  }}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- اختر فيديو --</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-700">المسارات المحفوظة ({tracks.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTrackId(null);
                    setTrackForm({
                      language: 'en',
                      language_label: 'English',
                      title: 'English Subtitles',
                      status: 'published',
                      is_default: false,
                      cues: [{ id: 'c1', start: '00:00:00.000', end: '00:00:04.000', text: '' }],
                    });
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#8C6A2F] cursor-pointer"
                >
                  <Plus size={13} /> مسار جديد
                </button>
              </div>

              <div className="space-y-2">
                {tracks.length === 0 ? (
                  <div className="text-xs text-neutral-500 p-4 rounded-lg bg-neutral-50 text-center">
                    <Subtitles size={20} className="mx-auto mb-1 text-neutral-400" />
                    لا توجد مسارات ترجمة لهذا الفيديو بعد.
                  </div>
                ) : (
                  tracks.map((tr) => (
                    <div
                      key={tr.id}
                      onClick={() => selectTrack(tr)}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                        activeTrackId === tr.id ? 'border-[#B08D45] bg-[#F7F4EC]/70' : 'border-neutral-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 truncate">{tr.language_label}</span>
                          {Boolean(tr.is_default) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#B08D45]/15 text-[#8C6A2F] text-[10px] font-bold">
                              <Star size={10} /> افتراضي
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {tr.language} · {tr.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!tr.is_default && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTrackAsDefault(tr.id);
                            }}
                            className="px-2 py-1 rounded border border-neutral-200 bg-white text-[10px] font-bold text-neutral-700 hover:border-[#B08D45] hover:text-[#8C6A2F] cursor-pointer"
                          >
                            تعيين كافتراضي
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await fetch(`/api/admin/subtitles/${tr.id}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            });
                            if (activeTrackId === tr.id) setActiveTrackId(null);
                            await loadTracks(selectedVideoId);
                          }}
                          className="text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={saveTrack} className="lg:col-span-8 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">رمز اللغة</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={trackForm.language}
                    onChange={(e) => setTrackForm({ ...trackForm, language: e.target.value })}
                    placeholder="ar / en / fr"
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">اسم اللغة الظاهر</label>
                  <input
                    type="text"
                    value={trackForm.language_label}
                    onChange={(e) => setTrackForm({ ...trackForm, language_label: e.target.value })}
                    placeholder="العربية"
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">عنوان المسار</label>
                  <input
                    type="text"
                    value={trackForm.title}
                    onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">الحالة</label>
                  <select
                    value={trackForm.status}
                    onChange={(e) => setTrackForm({ ...trackForm, status: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="published">منشور</option>
                    <option value="draft">مسودة</option>
                    <option value="hidden">مخفي</option>
                  </select>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackForm.is_default}
                  onChange={(e) => setTrackForm({ ...trackForm, is_default: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>مسار افتراضي لهذا الفيديو</span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer hover:bg-neutral-50">
                    <Upload size={13} />
                    <span>استيراد SRT / VTT</span>
                    <input
                      type="file"
                      accept=".srt,.vtt,text/vtt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImportFile(f);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={exportVtt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
                  >
                    <Download size={13} />
                    <span>تصدير WebVTT</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTrackForm({
                      ...trackForm,
                      cues: [
                        ...trackForm.cues,
                        {
                          id: `c-${Date.now()}`,
                          start: '00:00:04.000',
                          end: '00:00:08.000',
                          text: '',
                        },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F7F4EC] text-[#8C6A2F] text-xs font-bold cursor-pointer"
                >
                  <Plus size={13} /> إضافة سطر
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto border border-neutral-200 rounded-xl p-3 bg-neutral-50">
                {trackForm.cues.map((cue, idx) => (
                  <div key={cue.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      dir="ltr"
                      value={cue.start}
                      onChange={(e) =>
                        setTrackForm({
                          ...trackForm,
                          cues: trackForm.cues.map((c, i) =>
                            i === idx ? { ...c, start: e.target.value } : c
                          ),
                        })
                      }
                      className="sm:col-span-3 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={cue.end}
                      onChange={(e) =>
                        setTrackForm({
                          ...trackForm,
                          cues: trackForm.cues.map((c, i) =>
                            i === idx ? { ...c, end: e.target.value } : c
                          ),
                        })
                      }
                      className="sm:col-span-2 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={cue.text}
                      onChange={(e) =>
                        setTrackForm({
                          ...trackForm,
                          cues: trackForm.cues.map((c, i) =>
                            i === idx ? { ...c, text: e.target.value } : c
                          ),
                        })
                      }
                      placeholder="نص الترجمة..."
                      className="sm:col-span-5 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                    <div className="sm:col-span-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveCue(idx, -1)}
                        title="تحريك للأعلى"
                        className="p-1 text-neutral-600 hover:bg-neutral-200/70 rounded disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === trackForm.cues.length - 1}
                        onClick={() => moveCue(idx, 1)}
                        title="تحريك للأسفل"
                        className="p-1 text-neutral-600 hover:bg-neutral-200/70 rounded disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => previewCue(cue)}
                        title="معاينة هذا السطر في الفيديو"
                        className="p-1 text-[#8C6A2F] hover:bg-[#F7F4EC] rounded cursor-pointer"
                      >
                        <Play size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTrackForm({
                            ...trackForm,
                            cues: trackForm.cues.filter((_, i) => i !== idx),
                          })
                        }
                        className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
              >
                {activeTrackId ? 'حفظ تعديلات المسار' : 'حفظ ونشر مسار الترجمة'}
              </button>
            </form>
          </div>
        </AdminCard>

        {subStyle && (
          <AdminCard title="تنسيق ومظهر الترجمات داخل المشغل (كافة الخصائص)">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">نوع الخط</label>
                <select
                  value={subStyle.fontFamily}
                  onChange={(e) => setSubStyle({ ...subStyle, fontFamily: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="Cairo">Cairo</option>
                  <option value="Tajawal">Tajawal</option>
                  <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                  <option value="Amiri">Amiri</option>
                  <option value="Noto Kufi Arabic">Noto Kufi Arabic</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">حجم الخط للكمبيوتر (px)</label>
                <input
                  type="number"
                  min={12}
                  max={48}
                  value={subStyle.fontSizeDesktop}
                  onChange={(e) =>
                    setSubStyle({ ...subStyle, fontSizeDesktop: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">حجم الخط للجوال (px)</label>
                <input
                  type="number"
                  min={10}
                  max={36}
                  value={subStyle.fontSizeMobile}
                  onChange={(e) =>
                    setSubStyle({ ...subStyle, fontSizeMobile: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">سمك الخط</label>
                <select
                  value={subStyle.fontWeight}
                  onChange={(e) => setSubStyle({ ...subStyle, fontWeight: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="400">عادي (400)</option>
                  <option value="600">متوسط (600)</option>
                  <option value="700">عريض (700)</option>
                  <option value="800">ثقيل (800)</option>
                </select>
              </div>
              <ColorField
                label="لون نص الترجمة"
                value={subStyle.textColor}
                onChange={(v) => setSubStyle({ ...subStyle, textColor: v })}
              />
              <ColorField
                label="لون خلفية الترجمة"
                value={subStyle.backgroundColor}
                onChange={(v) => setSubStyle({ ...subStyle, backgroundColor: v })}
              />
              <div>
                <label className="block text-xs font-semibold mb-1">شفافية الخلفية (0 - 1)</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={subStyle.backgroundOpacity}
                  onChange={(e) =>
                    setSubStyle({ ...subStyle, backgroundOpacity: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <ColorField
                label="لون الحدود المحيطة بالنص (Outline)"
                value={subStyle.outlineColor}
                onChange={(v) => setSubStyle({ ...subStyle, outlineColor: v })}
              />
              <div>
                <label className="block text-xs font-semibold mb-1">سمك الحدود المحيطة (px)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={subStyle.outlineWidth}
                  onChange={(e) =>
                    setSubStyle({ ...subStyle, outlineWidth: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">ظل النص (CSS textShadow)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={subStyle.textShadow}
                  onChange={(e) => setSubStyle({ ...subStyle, textShadow: e.target.value })}
                  placeholder="0 2px 6px rgba(0,0,0,0.9)"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">محاذاة النص</label>
                <select
                  value={subStyle.textAlign}
                  onChange={(e) => setSubStyle({ ...subStyle, textAlign: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="center">توسيط</option>
                  <option value="right">يمين</option>
                  <option value="left">يسار</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">الموضع العمودي</label>
                <select
                  value={subStyle.position}
                  onChange={(e) => setSubStyle({ ...subStyle, position: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="bottom">الأسفل</option>
                  <option value="top">الأعلى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">المسافة عن الحافة (px)</label>
                <input
                  type="number"
                  min={8}
                  max={160}
                  value={subStyle.bottomMargin}
                  onChange={(e) =>
                    setSubStyle({ ...subStyle, bottomMargin: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">تباعد الأسطر (Line Height)</label>
                <input
                  type="number"
                  min={1}
                  max={2.4}
                  step={0.05}
                  value={subStyle.lineSpacing}
                  onChange={(e) =>
                    setSubStyle({ ...subStyle, lineSpacing: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">أقصى عرض للترجمة (%)</label>
                <input
                  type="number"
                  min={40}
                  max={98}
                  value={subStyle.maxWidthPercent}
                  onChange={(e) =>
                    setSubStyle({ ...subStyle, maxWidthPercent: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(subStyle.autoShowDefault)}
                    onChange={(e) =>
                      setSubStyle({ ...subStyle, autoShowDefault: e.target.checked })
                    }
                    className="accent-[#B08D45]"
                  />
                  <span>تشغيل الترجمة الافتراضية تلقائياً عند فتح الفيديو</span>
                </label>
              </div>
            </div>
          </AdminCard>
        )}
      </div>
      ) : i18nCfg ? (
        <div className="space-y-6">
          <AdminCard title="إعدادات تعدد اللغات للواجهة العامة">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={i18nCfg.enabled}
                  onChange={(e) => setI18nCfg({ ...i18nCfg, enabled: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>تفعيل دعم تعدد اللغات في الموقع العام</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={i18nCfg.showSwitcher}
                  onChange={(e) => setI18nCfg({ ...i18nCfg, showSwitcher: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار محوّل اللغة في شريط الترويسة</span>
              </label>
              <div>
                <label className="block text-xs font-semibold mb-1">اللغة الافتراضية للموقع</label>
                <select
                  value={i18nCfg.defaultLang}
                  onChange={(e) => setI18nCfg({ ...i18nCfg, defaultLang: e.target.value as 'ar' | 'en' })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {i18nCfg.languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label} ({lang.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </AdminCard>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <AdminCard title="اللغات المفعلة" className="lg:col-span-4">
              <button
                type="button"
                onClick={() => {
                  const newLang: SiteLanguageItem = {
                    code: `lang${i18nCfg.languages.length + 1}`,
                    label: 'لغة جديدة',
                    dir: 'ltr',
                    overrides: {},
                  };
                  setI18nCfg({ ...i18nCfg, languages: [...i18nCfg.languages, newLang] });
                  setSelectedLangIdx(i18nCfg.languages.length);
                }}
                className="w-full mb-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
              >
                <Plus size={14} /> إضافة لغة
              </button>
              <div className="space-y-2">
                {i18nCfg.languages.map((lang, idx) => (
                  <div
                    key={`${lang.code}-${idx}`}
                    onClick={() => setSelectedLangIdx(idx)}
                    className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer ${
                      selectedLangIdx === idx ? 'border-[#B08D45] bg-[#F7F4EC]' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-neutral-900">{lang.label}</div>
                      <div className="text-[11px] text-neutral-500">
                        {lang.code} · {lang.dir.toUpperCase()}
                      </div>
                    </div>
                    {lang.code !== 'ar' && i18nCfg.languages.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = i18nCfg.languages.filter((_, i) => i !== idx);
                          setI18nCfg({ ...i18nCfg, languages: next });
                          setSelectedLangIdx(0);
                        }}
                        className="text-red-600 p-1 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </AdminCard>

            <div className="lg:col-span-8">
              {i18nCfg.languages[selectedLangIdx] && (() => {
                const lang = i18nCfg.languages[selectedLangIdx];
                const updateLang = (patch: Partial<SiteLanguageItem>) => {
                  setI18nCfg({
                    ...i18nCfg,
                    languages: i18nCfg.languages.map((l, i) => (i === selectedLangIdx ? { ...l, ...patch } : l)),
                  });
                };
                return (
                  <AdminCard title={`تحرير نصوص اللغة: ${lang.label}`}>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1">رمز اللغة (ISO Code)</label>
                          <input
                            type="text"
                            dir="ltr"
                            value={lang.code}
                            onChange={(e) => updateLang({ code: e.target.value.trim() })}
                            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">اسم اللغة</label>
                          <input
                            type="text"
                            value={lang.label}
                            onChange={(e) => updateLang({ label: e.target.value })}
                            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">اتجاه القراءة</label>
                          <select
                            value={lang.dir}
                            onChange={(e) => updateLang({ dir: e.target.value as 'rtl' | 'ltr' })}
                            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                          >
                            <option value="rtl">من اليمين لليسار (RTL)</option>
                            <option value="ltr">من اليسار لليمين (LTR)</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-neutral-200 space-y-2.5">
                        <div className="text-xs font-bold text-neutral-800">
                          ترجمة / تخصيص نصوص الواجهة لهذه اللغة:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                          {I18N_OVERRIDE_KEYS.map((item) => (
                            <div key={item.key}>
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                {item.label}
                              </label>
                              <input
                                type="text"
                                dir={lang.dir}
                                value={lang.overrides?.[item.key] || ''}
                                onChange={(e) =>
                                  updateLang({
                                    overrides: {
                                      ...(lang.overrides || {}),
                                      [item.key]: e.target.value,
                                    },
                                  })
                                }
                                placeholder={(settings?.uiTexts as any)?.[item.key] || ''}
                                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </AdminCard>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
