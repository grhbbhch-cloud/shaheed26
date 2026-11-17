import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
  Film,
  Maximize2,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  AdminCard,
  AdminPanelHeader,
  ColorField,
  GradientEditor,
} from '../../../components/admin/AdminSharedUI';
import { VideoThumbnailSelector } from '../../../components/admin/VideoThumbnailSelector';
import { MediaCard } from '../../../components/MediaCard';
import { OfficialAccountAttribution } from '../../../components/OfficialAccountAttribution';
import { useAdmin } from '../../../context/AdminContext';
import { usePlatform } from '../../../context/PlatformContext';
import { CONTENT_TYPE_LABELS, formatArabicDate, formatBytes, formatDuration } from '../../../lib/styleEngine';
import { uploadFileInChunks, type UploadProgressInfo } from '../../../lib/uploadClient';
import type { ContentRecord, GradientConfig, MediaFileRecord, SubtitleCue } from '../../../types/platform';

function createVideoTitleGradient(): GradientConfig {
  return {
    enabled: true,
    type: 'linear',
    angle: 120,
    direction: 'to left',
    position: 'center',
    stops: ['#B08D45', '#D4AF65', '#F7F4EC', '#8C6A2F'],
    opacity: 1,
    intensity: 1.1,
    animated: true,
    animationSpeed: 4,
    animationDirection: 'alternate',
    timingFunction: 'ease-in-out',
    transitionSpeedMs: 450,
    spreadPercent: 260,
    loop: true,
  };
}

interface QueueItem {
  id: string;
  file: File;
  progress: UploadProgressInfo;
  error?: string;
  warning?: string;
  duplicate?: boolean;
  controller: AbortController;
}

export function AdminUploads() {
  const { mediaFiles, pages, settings, refreshAll, notify } = useAdmin();
  const { refreshBootstrap } = usePlatform();

  const contentTypeLabels = useMemo(
    () => ({
      ...CONTENT_TYPE_LABELS,
      ...(settings?.uiTexts?.contentTypeLabels || {}),
    }),
    [settings?.uiTexts?.contentTypeLabels]
  );

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified Publish Workflow state
  const [activeMedia, setActiveMedia] = useState<MediaFileRecord | null>(null);
  const [thumbs, setThumbs] = useState<
    Array<{ index?: number; timestamp: number; url: string; selected?: boolean; isCustom?: boolean }>
  >([]);
  const [lightboxThumb, setLightboxThumb] = useState<string | null>(null);
  const [extractingThumbs, setExtractingThumbs] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string>('');
  const [publishedSuccess, setPublishedSuccess] = useState<{
    id: number;
    title: string;
    slug: string;
    status: string;
    locations: string[];
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Quick subtitle track inside unified flow
  const [enableSubtitle, setEnableSubtitle] = useState(false);
  const [subLang, setSubLang] = useState('ar');
  const [subLangLabel, setSubLangLabel] = useState('العربية');
  const [subCues, setSubCues] = useState<SubtitleCue[]>([
    { id: 'c1', start: '00:00:00.000', end: '00:00:05.000', text: '' },
  ]);

  const homePage = useMemo(
    () => pages.find((p) => p.page_type === 'home' || p.slug === 'home') || null,
    [pages]
  );
  const mainPages = useMemo(() => pages.filter((p) => !p.parent_id && p.status !== 'deleted'), [pages]);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    content_type: 'video' as ContentRecord['content_type'],
    description: '',
    body: '',
    status: 'published' as ContentRecord['status'],
    featured: false,
    showOnHome: true,
    page_id: '',
    child_page_id: '',
    extra_page_ids: [] as number[],
    category: '',
    tags: '',
    thumbnail_url: '',
    media_url: '',
    source_label: settings?.identity?.siteName || 'أرشيف الشهيد',
    editor_label: '',
    scheduled_at: '',
    // Per-item animated title settings
    titleGradientMode: 'custom' as 'inherit' | 'custom' | 'disabled',
    titleGradient: createVideoTitleGradient(),
    // Clickable link
    link_enabled: false,
    link_url: '',
    link_label: '',
    link_new_tab: true,
    altText: '',
    // Metadata & overrides
    dateIsManual: false,
    customPublishedAt: '',
    allowDownload: true,
    allowShare: true,
    showOfficialAccount: false,
    officialAccountPlacement: 'inherit' as 'inherit' | 'below-media' | 'below-title' | 'below-content',
    extBtnColor: '',
    extBtnCircleBg: '',
    relatedMaxOverride: '',
    titleColorOverride: '',
    borderColor: '',
    borderWidth: 0,
    borderRadius: 10,
    glowColor: '',
    customFieldValues: {} as Record<string, string>,
  });

  const childPagesForMain = useMemo(() => {
    if (!form.page_id) return pages.filter((p) => p.parent_id !== null && p.status !== 'deleted');
    return pages.filter((p) => String(p.parent_id) === String(form.page_id) && p.status !== 'deleted');
  }, [pages, form.page_id]);

  const loadSessions = async () => {
    const res = await fetch('/api/admin/uploads/sessions', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions || []);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const bindMediaToWorkflow = async (m: MediaFileRecord, warning?: string) => {
    setActiveMedia(m);
    let parsedThumbs: Array<{
      index?: number;
      timestamp: number;
      url: string;
      selected?: boolean;
      isCustom?: boolean;
    }> = [];
    try {
      parsedThumbs = JSON.parse(m.thumbnails_json || '[]');
    } catch {
      parsedThumbs = [];
    }

    // Automatically trigger 6-frame extraction if a video has fewer than 6 extracted frames
    const extractedCount = parsedThumbs.filter((t) => !t.isCustom).length;
    if (m.media_kind === 'video' && extractedCount < 6) {
      setExtractingThumbs(true);
      try {
        const res = await fetch(`/api/admin/media/${m.id}/extract-thumbnails`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.file) setActiveMedia(data.file);
          if (Array.isArray(data.frames) && data.frames.length > 0) {
            parsedThumbs = data.frames;
          }
          if (data.warning && !warning) warning = data.warning;
          await refreshAll();
        }
      } catch {
        // Keep existing thumbs if request fails
      } finally {
        setExtractingThumbs(false);
      }
    }

    setThumbs(parsedThumbs);

    const detectedType: ContentRecord['content_type'] =
      m.media_kind === 'video'
        ? 'video'
        : m.media_kind === 'image'
          ? 'image'
          : m.media_kind === 'audio'
            ? 'audio'
            : m.media_kind === 'document'
              ? 'document'
              : 'post';

    const defaultPage =
      mainPages.find((p) =>
        detectedType === 'video'
          ? p.slug === 'videos'
          : detectedType === 'image'
            ? p.slug === 'images'
            : p.slug === 'posts'
      ) || mainPages.find((p) => p.page_type !== 'home') || mainPages[0];

    const preferredThumb =
      parsedThumbs.find((t) => t.selected)?.url ||
      parsedThumbs[0]?.url ||
      (m.media_kind === 'image' ? m.public_url : '');

    setPublishError('');
    setPublishedSuccess(null);
    setForm((prev) => ({
      ...prev,
      content_type: detectedType,
      title: prev.title || m.original_name.replace(/\.[^.]+$/, ''),
      media_url: m.public_url,
      thumbnail_url: preferredThumb || prev.thumbnail_url,
      page_id: prev.page_id || (defaultPage ? String(defaultPage.id) : ''),
    }));

    if (warning) notify(warning, 'info');
  };

  const startUpload = async (file: File, allowDuplicate = false) => {
    const id = `${Date.now()}_${Math.random()}`;
    const controller = new AbortController();
    const initial: QueueItem = {
      id,
      file,
      controller,
      progress: {
        phase: 'hashing',
        percent: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        currentChunk: 0,
        totalChunks: Math.max(1, Math.ceil(file.size / (2 * 1024 * 1024))),
      },
    };
    setQueue((prev) => [initial, ...prev]);

    try {
      const result = await uploadFileInChunks(
        file,
        (prog) => {
          setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, progress: prog } : q)));
        },
        { allowDuplicate, signal: controller.signal }
      );

      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, duplicate: result.duplicate, warning: result.thumbnailWarning }
            : q
        )
      );
      await refreshAll();
      await loadSessions();
      bindMediaToWorkflow(result.media, result.thumbnailWarning);
      notify(
        result.duplicate
          ? `تم ربط الملف "${file.name}" (موجود مسبقاً) وإعداده للنشر`
          : `تم رفع "${file.name}" بنجاح — أكمل تفاصيل النشر أدناه`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل الرفع';
      setQueue((prev) =>
        prev.map((q) =>
          q.id === id
            ? { ...q, error: msg, progress: { ...q.progress, phase: 'error' } }
            : q
        )
      );
      await loadSessions();
      notify(msg, 'error');
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => startUpload(f));
  };


  const selectThumbnail = async (url: string) => {
    setForm((prev) => ({ ...prev, thumbnail_url: url }));
    setThumbs((prev) => prev.map((t) => ({ ...t, selected: t.url === url })));
    if (activeMedia) {
      try {
        const res = await fetch(`/api/admin/media/${activeMedia.id}/select-thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ url, applyToLinkedContent: true }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.file) setActiveMedia(data.file);
          if (Array.isArray(data.frames)) setThumbs(data.frames);
          await refreshAll();
          await refreshBootstrap();
        }
      } catch {
        // Local form state already updated
      }
    }
  };

  const uploadCustomThumbnail = async (file: File) => {
    try {
      if (activeMedia) {
        const upRes = await uploadFileInChunks(file);
        const res = await fetch(`/api/admin/media/${activeMedia.id}/custom-thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ url: upRes.media.public_url, applyToLinkedContent: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'تعذر حفظ الصورة المصغرة المخصصة');
        if (data.file) {
          setActiveMedia(data.file);
          try {
            setThumbs(JSON.parse(data.file.thumbnails_json || '[]'));
          } catch {}
        }
        setForm((prev) => ({ ...prev, thumbnail_url: upRes.media.public_url }));
        await refreshAll();
        await refreshBootstrap();
        notify('تم رفع وتعيين الصورة المصغرة المخصصة');
      } else {
        const upRes = await uploadFileInChunks(file);
        setForm((prev) => ({ ...prev, thumbnail_url: upRes.media.public_url }));
        notify('تم رفع صورة الغلاف بنجاح');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الغلاف', 'error');
    }
  };

  const buildTitleOverrideSettings = () => {
    const baseColor = form.titleColorOverride ? { color: form.titleColorOverride } : {};
    if (form.titleGradientMode === 'disabled') {
      return {
        titleGradientMode: 'disabled',
        titleStyleOverride: {
          ...baseColor,
          disableTargetGradient: true,
          gradient: { ...form.titleGradient, enabled: false },
        },
      };
    }
    if (form.titleGradientMode === 'custom') {
      return {
        titleGradientMode: 'custom',
        titleStyleOverride: {
          ...baseColor,
          disableTargetGradient: false,
          gradient: { ...form.titleGradient, enabled: true },
        },
      };
    }
    return {
      titleGradientMode: 'inherit',
      ...(form.titleColorOverride ? { titleStyleOverride: { ...baseColor } } : {}),
    };
  };

  const handlePublish = async (overrideStatus?: ContentRecord['status']) => {
    const finalStatus = overrideStatus || form.status;
    setPublishError('');
    if (!form.title.trim()) {
      const msg = 'يرجى إدخال عنوان المادة أولاً قبل النشر.';
      setPublishError(msg);
      notify(msg, 'error');
      return;
    }
    if (finalStatus === 'scheduled' && !form.scheduled_at) {
      const msg = 'يرجى تحديد تاريخ ووقت الجدولة.';
      setPublishError(msg);
      notify(msg, 'error');
      return;
    }

    setPublishing(true);
    try {
      const customMetadata: Record<string, string> = {};
      for (const [k, v] of Object.entries(form.customFieldValues)) {
        if (v !== undefined && v !== '') customMetadata[`__field_${k}`] = v;
      }

      const combinedExtraIds = Array.from(
        new Set([
          ...form.extra_page_ids,
          ...(form.showOnHome && homePage ? [homePage.id] : []),
        ])
      ).filter((id) => !(homePage && !form.showOnHome && id === homePage.id));

      const settingsObj: any = {
        allowDownload: form.allowDownload,
        allowShare: form.allowShare,
        borderColor: form.borderColor,
        borderWidth: form.borderWidth,
        borderRadius: form.borderRadius,
        glowColor: form.glowColor,
        altText: form.altText,
        linkLabel: form.link_label,
        dateIsManual: form.dateIsManual,
        customPublishedAt: form.customPublishedAt,
        showOfficialAccount: form.showOfficialAccount,
        officialAccountPlacement: form.officialAccountPlacement,
        ...buildTitleOverrideSettings(),
        ...(form.extBtnColor || form.extBtnCircleBg
          ? {
              externalPlayButtonOverride: {
                ...(form.extBtnColor ? { iconColor: form.extBtnColor } : {}),
                ...(form.extBtnCircleBg ? { circleBackground: form.extBtnCircleBg } : {}),
              },
            }
          : {}),
        ...(form.relatedMaxOverride ? { relatedOverride: { maxItems: Number(form.relatedMaxOverride) } } : {}),
      };

      const res = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: form.title.trim(),
          slug: form.slug.trim() || undefined,
          content_type: form.content_type,
          description: form.description,
          body: form.body,
          status: finalStatus,
          featured: form.featured,
          page_id: form.page_id ? Number(form.page_id) : null,
          child_page_id: form.child_page_id ? Number(form.child_page_id) : null,
          extra_page_ids: combinedExtraIds,
          category: form.category,
          tags: form.tags
            .split(/[،,]/)
            .map((t) => t.trim())
            .filter(Boolean),
          thumbnail_url: form.thumbnail_url,
          media_url: form.media_url,
          media_file_id: activeMedia?.id || null,
          link_url: form.link_url,
          link_label: form.link_label,
          link_enabled: form.link_enabled,
          link_new_tab: form.link_new_tab,
          duration: activeMedia?.duration || 0,
          resolution: activeMedia?.height ? `${activeMedia.height}p` : '',
          width: activeMedia?.width || 0,
          height: activeMedia?.height || 0,
          views: 0,
          source_label: form.source_label,
          editor_label: form.editor_label,
          custom_metadata: customMetadata,
          scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
          settings: settingsObj,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.item?.id) {
        throw new Error(data.error || 'فشل حفظ ونشر المادة في قاعدة البيانات');
      }
      if (data.item.status !== finalStatus) {
        throw new Error(`تعذر تأكيد حالة النشر (${data.item.status} بدلاً من ${finalStatus})`);
      }

      if (activeMedia?.id && form.thumbnail_url) {
        await fetch(`/api/admin/media/${activeMedia.id}/select-thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ url: form.thumbnail_url, applyToLinkedContent: false }),
        }).catch(() => {});
      }

      // Optionally create quick subtitle track
      if (enableSubtitle && data.item?.id && subCues.some((c) => c.text.trim())) {
        await fetch('/api/admin/subtitles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            content_id: data.item.id,
            language: subLang,
            language_label: subLangLabel,
            title: `ترجمة ${subLangLabel}`,
            status: 'published',
            visible: 1,
            cues: subCues.filter((c) => c.text.trim()),
          }),
        });
      }

      // Verify genuine public visibility when publishing immediately
      if (finalStatus === 'published') {
        const verifyRes = await fetch(`/api/public/content/${encodeURIComponent(data.item.slug)}`, {
          cache: 'no-store',
        });
        if (!verifyRes.ok) {
          throw new Error('تم إنشاء السجل لكن تعذر التحقق من ظهوره على الواجهة العامة، أعد المحاولة.');
        }
      }

      await refreshAll();
      await refreshBootstrap();

      const locLabels: string[] = [];
      if (form.showOnHome) locLabels.push('الصفحة الرئيسية');
      if (data.item.page_title) locLabels.push(data.item.page_title);
      if (data.item.child_page_title) locLabels.push(data.item.child_page_title);
      for (const eid of combinedExtraIds) {
        const ep = pages.find((p) => p.id === eid);
        if (ep && !locLabels.includes(ep.title)) locLabels.push(ep.title);
      }

      setPublishedSuccess({
        id: data.item.id,
        title: data.item.title,
        slug: data.item.slug,
        status: data.item.status,
        locations: locLabels,
      });

      notify(
        finalStatus === 'published'
          ? 'تم التحقق والنشر بنجاح! المادة ظاهرة الآن على الموقع العام والصفحات المختارة.'
          : 'تم حفظ المادة بنجاح في الأرشيف / المسودات'
      );

      // Reset publishing workflow cleanly for next upload while preserving published banner
      setActiveMedia(null);
      setThumbs([]);
      setForm((prev) => ({
        ...prev,
        title: '',
        slug: '',
        description: '',
        body: '',
        thumbnail_url: '',
        media_url: '',
        link_url: '',
        link_label: '',
        link_enabled: false,
        extra_page_ids: [],
        customFieldValues: {},
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام النشر';
      setPublishError(msg);
      notify(msg, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const cleanupOrphanChunks = async () => {
    const res = await fetch('/api/admin/media/cleanup-chunks', {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await loadSessions();
      notify('تم تنظيف الأجزاء المؤقتة غير المكتملة');
    }
  };

  const previewItem: ContentRecord = {
    id: 0,
    title: form.title || 'عنوان المادة التجريبي',
    slug: form.slug || 'preview',
    content_type: form.content_type,
    description: form.description,
    body: form.body,
    status: form.status,
    featured: form.featured ? 1 : 0,
    page_id: form.page_id ? Number(form.page_id) : null,
    child_page_id: form.child_page_id ? Number(form.child_page_id) : null,
    extra_page_ids_json: JSON.stringify(form.extra_page_ids),
    category: form.category,
    tags_json: '[]',
    thumbnail_url: form.thumbnail_url,
    media_url: form.media_url,
    media_file_id: activeMedia?.id || null,
    gallery_urls_json: '[]',
    link_url: form.link_url,
    link_label: form.link_label,
    link_enabled: form.link_enabled ? 1 : 0,
    link_new_tab: form.link_new_tab ? 1 : 0,
    duration: activeMedia?.duration || 0,
    resolution: activeMedia?.height ? `${activeMedia.height}p` : '',
    width: activeMedia?.width || 0,
    height: activeMedia?.height || 0,
    views: 0,
    source_label: form.source_label,
    editor_label: form.editor_label,
    custom_metadata_json: '{}',
    settings_json: JSON.stringify({
      dateIsManual: form.dateIsManual,
      customPublishedAt: form.customPublishedAt,
      showOfficialAccount: form.showOfficialAccount,
      officialAccountPlacement: form.officialAccountPlacement,
      altText: form.altText,
      borderColor: form.borderColor,
      borderWidth: form.borderWidth,
      borderRadius: form.borderRadius,
      glowColor: form.glowColor,
      ...buildTitleOverrideSettings(),
      ...(form.extBtnColor || form.extBtnCircleBg
        ? {
            externalPlayButtonOverride: {
              ...(form.extBtnColor ? { iconColor: form.extBtnColor } : {}),
              ...(form.extBtnCircleBg ? { circleBackground: form.extBtnCircleBg } : {}),
            },
          }
        : {}),
    }),
    published_at: new Date().toISOString(),
    scheduled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    page_title: pages.find((p) => String(p.id) === form.page_id)?.title,
    child_page_title: pages.find((p) => String(p.id) === form.child_page_id)?.title,
  };

  const globalFields = settings?.infoCard?.fields?.filter((f) => !f.deleted) || [];

  return (
    <div>
      <AdminPanelHeader
        title="مركز الرفع والنشر المتكامل"
        subtitle="ارفع الملف عبر الرفع المجزأ الموثوق، اختر إحدى الصور المصغرة الست المستخرجة عبر FFmpeg، اربطها بصفحات المنصة، وانشرها فوراً من شاشة واحدة."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
            >
              <Eye size={14} />
              <span>معاينة البطاقة قبل النشر</span>
            </button>
            <button
              type="button"
              onClick={cleanupOrphanChunks}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>تنظيف الجلسات المعلقة</span>
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Step 1: Dropzone + Existing Library Quick Pick */}
        <AdminCard
          title="1. رفع الملف أو اختياره من المكتبة"
          subtitle="يدعم الفيديوهات الطويلة (30+ دقيقة عبر أجزاء 2 م.ب قابلة للاستئناف)، الصور، الصوتيات، والوثائق — أو انتقل مباشرة لكتابة مادة/مقال بدون ملف."
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFilesSelected(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 hover:border-[#B08D45] rounded-xl p-8 text-center cursor-pointer transition-colors bg-neutral-50/70"
              >
                <Upload size={30} className="mx-auto text-[#B08D45] mb-2.5" />
                <div className="text-sm font-bold text-neutral-900">
                  اسحب وأفلت الملف هنا أو اضغط لاختياره من جهازك
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  سيتم فحص بصمة الملف، رفعه على أجزاء، واستخراج 6 صور مصغرة تلقائياً للفيديو.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </div>

              {queue.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  {queue.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-neutral-200 p-3 bg-white space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-neutral-900 truncate">{q.file.name}</div>
                          <div className="text-[11px] text-neutral-500 tabular-nums">
                            {formatBytes(q.progress.uploadedBytes)} / {formatBytes(q.progress.totalBytes)} ·
                            الأجزاء: {q.progress.currentChunk}/{q.progress.totalChunks} ({q.progress.percent}%)
                            {q.progress.phase === 'uploading' && q.progress.speedBytesPerSec ? (
                              <>
                                {' '}
                                · السرعة: {formatBytes(q.progress.speedBytesPerSec)}/ث
                                {q.progress.remainingBytes !== undefined
                                  ? ` · المتبقي: ${formatBytes(q.progress.remainingBytes)}`
                                  : ''}
                                {q.progress.etaSeconds !== undefined
                                  ? ` (~${Math.ceil(q.progress.etaSeconds)} ث)`
                                  : ''}
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {q.progress.phase === 'done' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#8C6A2F]">
                              <CheckCircle2 size={14} /> {q.duplicate ? 'مربوط' : 'مكتمل'}
                            </span>
                          )}
                          {q.progress.phase === 'error' && (
                            <button
                              type="button"
                              onClick={() => startUpload(q.file)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#B08D45] text-white text-[11px] cursor-pointer"
                            >
                              <RefreshCw size={11} /> إعادة
                            </button>
                          )}
                          {q.progress.phase === 'uploading' && (
                            <button
                              type="button"
                              onClick={() => q.controller.abort()}
                              className="text-xs text-red-600 font-semibold cursor-pointer"
                            >
                              إيقاف
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
                        <div
                          className={`h-full transition-all ${q.progress.phase === 'error' ? 'bg-red-600' : 'bg-[#B08D45]'}`}
                          style={{ width: `${q.progress.percent}%` }}
                        />
                      </div>
                      {q.error && <div className="text-[11px] text-red-600 flex items-center gap-1"><XCircle size={12} /> {q.error}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">
                  أو اربط ملفاً موجوداً من المكتبة
                </label>
                <select
                  value={activeMedia?.id ?? ''}
                  onChange={(e) => {
                    const m = mediaFiles.find((x) => String(x.id) === e.target.value);
                    if (m) bindMediaToWorkflow(m);
                  }}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- بدون ملف محدد / اختر من المكتبة --</option>
                  {mediaFiles.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.original_name} ({m.media_kind} · {formatBytes(m.file_size)})
                    </option>
                  ))}
                </select>
              </div>

              {activeMedia && (
                <div className="rounded-xl border border-[#E8E0D0] bg-[#F7F4EC] p-3 space-y-1 text-xs">
                  <div className="font-bold text-[#171717] truncate">{activeMedia.original_name}</div>
                  <div className="text-[11px] text-neutral-600 tabular-nums">
                    النوع: {activeMedia.media_kind} · الدقة: {activeMedia.width}×{activeMedia.height} · المدة:{' '}
                    {formatDuration(activeMedia.duration)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </AdminCard>

        {/* Step 2: Real Extracted Video Thumbnails Selector + Custom Upload */}
        <AdminCard
          title="2. استخراج واختيار الصورة المصغرة الحقيقية من الفيديو"
          subtitle="استخرج لقطات حقيقية من الفيديو عبر FFmpeg أو المتصفح، اختر الفاصل الزمني أو توقيتاً محدداً، واعتمد الإطار الأنسب للعرض العام."
        >
          {activeMedia?.media_kind === 'video' ? (
            <div className="space-y-4">
              {extractingThumbs && (
                <div className="p-3 rounded-xl bg-[#F7F4EC] border border-[#B08D45]/30 text-xs font-semibold text-[#8C6A2F] flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>جاري فك تشفير الفيديو واستخراج الإطارات الأولية...</span>
                </div>
              )}
              <VideoThumbnailSelector
                media={activeMedia}
                savedThumbnailUrl={form.thumbnail_url}
                onConfirmThumbnail={async (url, updatedMedia) => {
                  setForm((prev) => ({ ...prev, thumbnail_url: url }));
                  if (updatedMedia) {
                    setActiveMedia(updatedMedia);
                    try {
                      setThumbs(JSON.parse(updatedMedia.thumbnails_json || '[]'));
                    } catch {}
                  }
                  await refreshAll();
                  await refreshBootstrap();
                }}
                onClearThumbnail={async (updatedMedia) => {
                  setForm((prev) => ({ ...prev, thumbnail_url: '' }));
                  if (updatedMedia) setActiveMedia(updatedMedia);
                  setThumbs([]);
                  await refreshAll();
                  await refreshBootstrap();
                }}
                onMediaUpdated={(updatedMedia) => {
                  setActiveMedia(updatedMedia);
                  try {
                    setThumbs(JSON.parse(updatedMedia.thumbnails_json || '[]'));
                  } catch {}
                }}
                onNotify={notify}
                onOpenLightbox={(url) => setLightboxThumb(url)}
              />
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                  رابط الصورة المصغرة المعتمد:
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                  placeholder="سيتم تعبئته تلقائياً عند اعتماد إطار..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7F4EC] text-[#8C6A2F] border border-[#B08D45]/40 text-xs font-bold cursor-pointer hover:bg-[#E8E0D0]">
                  <Upload size={13} />
                  <span>رفع صورة غلاف مخصصة</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadCustomThumbnail(f);
                    }}
                  />
                </label>
                <div className="flex-1 min-w-[240px]">
                  <input
                    type="text"
                    dir="ltr"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                    placeholder="رابط الصورة المصغرة المختارة..."
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
              {form.thumbnail_url && (
                <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-[#F7F4EC] border border-[#B08D45]/30">
                  <img
                    src={form.thumbnail_url}
                    alt="الصورة المصغرة المختارة"
                    className="w-28 aspect-video rounded-lg object-cover border border-neutral-200 bg-black shrink-0"
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="font-bold text-[#8C6A2F] flex items-center gap-1">
                      <CheckCircle2 size={13} /> صورة الغلاف المعتمدة حالياً
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLightboxThumb(form.thumbnail_url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
                  >
                    <Maximize2 size={12} /> معاينة
                  </button>
                </div>
              )}
            </div>
          )}
        </AdminCard>

        {/* Step 3: Essential Publishing Fields + Page Routing */}
        <AdminCard title="3. البيانات الأساسية واختيار الصفحات">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان المادة</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="أدخل عنواناً واضحاً..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نوع المحتوى</label>
                <select
                  value={form.content_type}
                  onChange={(e) => setForm({ ...form, content_type: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  {Object.entries(contentTypeLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الرابط المختصر (Slug)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="تلقائي إذا تُرك فارغاً"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F4EC] border border-[#E8E0D0] flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2.5 text-xs font-bold text-[#171717] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnHome}
                  onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })}
                  className="accent-[#B08D45] h-4 w-4"
                />
                <span>إظهار ونشر المادة في الصفحة الرئيسية (الرئيسية + أحدث الإصدارات)</span>
              </label>
              <span className="text-[11px] text-[#8C6A2F] font-semibold">
                {form.showOnHome ? 'سيظهر في الرئيسية فور النشر' : 'سيظهر في الصفحات المختارة أدناه فقط'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">الصفحة الرئيسية المستهدفة</label>
                <select
                  value={form.page_id}
                  onChange={(e) => {
                    const nextPageId = e.target.value;
                    const stillChild = pages.some(
                      (p) => String(p.id) === String(form.child_page_id) && String(p.parent_id) === String(nextPageId)
                    );
                    setForm({ ...form, page_id: nextPageId, child_page_id: stillChild ? form.child_page_id : '' });
                  }}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- اختر الصفحة --</option>
                  {mainPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">الصفحة الفرعية</label>
                <select
                  value={form.child_page_id}
                  onChange={(e) => setForm({ ...form, child_page_id: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="">-- بدون صفحة فرعية --</option>
                  {childPagesForMain.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">التصنيف والوسوم</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="مثال: تقارير ميدانية"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                />
              </div>
            </div>

            {pages.filter((p) => p.status !== 'deleted').length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  أماكن وصفحات عرض إضافية (يمكن تحديد أكثر من صفحة وصفحة فرعية):
                </label>
                <div className="flex flex-wrap gap-2">
                  {pages
                    .filter((p) => p.status !== 'deleted' && p.page_type !== 'home')
                    .map((p) => {
                      const active = form.extra_page_ids.includes(p.id);
                      const parentTitle = p.parent_id ? pages.find((x) => x.id === p.parent_id)?.title : '';
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              extra_page_ids: active
                                ? form.extra_page_ids.filter((id) => id !== p.id)
                                : [...form.extra_page_ids, p.id],
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${
                            active
                              ? 'bg-[#B08D45] text-white border-[#B08D45]'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#B08D45]'
                          }`}
                        >
                          {parentTitle ? `${parentTitle} ← ${p.title}` : p.title}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">الوصف المختصر</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">النص التفصيلي / المقال</label>
              <textarea
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>

            {/* Clickable Destination URL */}
            <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">ربط الصورة / البطاقة برابط انتقال عند النقر</span>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.link_enabled}
                    onChange={(e) => setForm({ ...form, link_enabled: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>تفعيل الرابط</span>
                </label>
              </div>
              {form.link_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    dir="ltr"
                    value={form.link_url}
                    onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                    placeholder="https://... أو /p/reports"
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={form.link_label}
                    onChange={(e) => setForm({ ...form, link_label: e.target.value })}
                    placeholder="نص الرابط (اختياري)"
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.link_new_tab}
                      onChange={(e) => setForm({ ...form, link_new_tab: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>فتح في تبويب جديد</span>
                  </label>
                </div>
              )}
            </div>

            {/* Per-Video Animated Title Colors Section */}
            <div className="rounded-xl border border-[#E8E0D0] bg-[#F7F4EC]/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-[#B08D45]" />
                  <div>
                    <h4 className="text-xs font-extrabold text-neutral-900">
                      ألوان وتدرج العنوان المتحرك الخاص بهذه المادة
                    </h4>
                    <p className="text-[11px] text-neutral-600">
                      تتحكم هذه الإعدادات بمظهر عنوان الفيديو على الرئيسية والصفحات وصفحة العرض بشكل مستقل.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'custom', label: 'تدرج متحرك مخصص لهذا الفيديو' },
                      { id: 'inherit', label: 'استخدام إعدادات الموقع العامة' },
                      { id: 'disabled', label: 'تعطيل حركة الألوان (لون ثابت)' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setForm({ ...form, titleGradientMode: mode.id })}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        form.titleGradientMode === mode.id
                          ? 'bg-[#B08D45] text-white border-[#B08D45]'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#B08D45]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.titleGradientMode === 'custom' && (
                <GradientEditor
                  value={form.titleGradient}
                  onChange={(next) => setForm({ ...form, titleGradient: next })}
                  title="ضبط الألوان المتعددة، الاتجاه، السرعة، ونعومة حركة العنوان"
                  previewText={form.title || 'معاينة عنوان الفيديو بالخط والتدرج المتحرك'}
                />
              )}
              {form.titleGradientMode === 'disabled' && (
                <div className="max-w-xs">
                  <ColorField
                    label="لون العنوان الثابت لهذا الفيديو"
                    value={form.titleColorOverride || '#171717'}
                    onChange={(v) => setForm({ ...form, titleColorOverride: v })}
                  />
                </div>
              )}
            </div>

            {/* Optional Official Account Attribution Toggle */}
            <div className="rounded-xl border border-[#E8E0D0] bg-[#FAF8F4] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-neutral-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showOfficialAccount}
                    onChange={(e) => setForm({ ...form, showOfficialAccount: e.target.checked })}
                    className="accent-[#B08D45] h-4 w-4"
                  />
                  <ShieldCheck size={15} className="text-[#B08D45]" />
                  <span>إظهار توثيق الحساب الرسمي على هذه المادة</span>
                </label>
                {form.showOfficialAccount && (
                  <select
                    value={form.officialAccountPlacement}
                    onChange={(e) => setForm({ ...form, officialAccountPlacement: e.target.value as any })}
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold"
                  >
                    <option value="inherit">الموضع: الافتراضي ({settings?.officialAccount?.defaultPlacement || 'below-media'})</option>
                    <option value="below-media">أسفل الوسائط مباشرة</option>
                    <option value="below-title">أسفل العنوان</option>
                    <option value="below-content">أسفل نص المحتوى</option>
                  </select>
                )}
              </div>
              {form.showOfficialAccount && (
                <div className="space-y-2">
                  {(!settings?.officialAccount || settings.officialAccount.deleted || !settings.officialAccount.enabled) && (
                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      ملاحظة: الحساب الرسمي غير مفعّل أو غير منشأ حالياً في قسم «الحساب الرسمي الموثق»، ولن يظهر للزوار إلا بعد تفعيله.
                    </div>
                  )}
                  <OfficialAccountAttribution configOverride={settings?.officialAccount} previewMode />
                </div>
              )}
            </div>

            {/* Step 4: Advanced Settings Accordion */}
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between text-xs font-extrabold text-neutral-900 cursor-pointer"
              >
                <span>الإعدادات المتقدمة (التاريخ اليدوي، حقول البطاقة، المشغل، المحتوى المشابه، والترجمة)</span>
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvanced && (
                <div className="p-4 space-y-5 bg-white border-t border-neutral-200">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">المصدر</label>
                      <input
                        type="text"
                        value={form.source_label}
                        onChange={(e) => setForm({ ...form, source_label: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">المحرر</label>
                      <input
                        type="text"
                        value={form.editor_label}
                        onChange={(e) => setForm({ ...form, editor_label: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">الوصف البديل للصورة (Alt)</label>
                      <input
                        type="text"
                        value={form.altText}
                        onChange={(e) => setForm({ ...form, altText: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Manual vs Auto Date */}
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.dateIsManual}
                        onChange={(e) => setForm({ ...form, dateIsManual: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>كتابة تاريخ النشر يدوياً</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600">
                        {form.dateIsManual ? 'يدوي' : 'تلقائي'}
                      </span>
                    </label>
                    {form.dateIsManual && (
                      <input
                        type="text"
                        value={form.customPublishedAt}
                        onChange={(e) => setForm({ ...form, customPublishedAt: e.target.value })}
                        placeholder="مثال: ١٠ ربيع الأول ١٤٤٨"
                        className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    )}
                  </div>

                  {/* Per-item Custom InfoCard Fields */}
                  {globalFields.some((f) => f.key.startsWith('custom_')) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {globalFields
                        .filter((f) => f.key.startsWith('custom_'))
                        .map((f) => (
                          <div key={f.key}>
                            <label className="block text-xs font-semibold mb-1">{f.label}</label>
                            <input
                              type="text"
                              value={form.customFieldValues[f.key] || ''}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  customFieldValues: {
                                    ...form.customFieldValues,
                                    [f.key]: e.target.value,
                                  },
                                })
                              }
                              className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                            />
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Permissions + Related + Player overrides */}
                  <div className="flex flex-wrap gap-5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.featured}
                        onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>تمييز المادة</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.allowDownload}
                        onChange={(e) => setForm({ ...form, allowDownload: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>السماح بالتحميل</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.allowShare}
                        onChange={(e) => setForm({ ...form, allowShare: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>السماح بالمشاركة</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <ColorField
                      label="لون عنوان المادة"
                      value={form.titleColorOverride}
                      onChange={(v) => setForm({ ...form, titleColorOverride: v })}
                    />
                    <ColorField
                      label="لون أيقونة التشغيل"
                      value={form.extBtnColor}
                      onChange={(v) => setForm({ ...form, extBtnColor: v })}
                    />
                    <ColorField
                      label="خلفية زر التشغيل"
                      value={form.extBtnCircleBg}
                      onChange={(v) => setForm({ ...form, extBtnCircleBg: v })}
                    />
                    <div>
                      <label className="block text-xs font-semibold mb-1">حد المحتوى المشابه</label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={form.relatedMaxOverride}
                        onChange={(e) => setForm({ ...form, relatedMaxOverride: e.target.value })}
                        placeholder="افتراضي"
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Quick Subtitle Attachment for Videos */}
                  {form.content_type === 'video' && (
                    <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2.5">
                      <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enableSubtitle}
                          onChange={(e) => setEnableSubtitle(e.target.checked)}
                          className="accent-[#B08D45]"
                        />
                        <span>إضافة ترجمة مباشرة مع النشر</span>
                      </label>
                      {enableSubtitle && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              dir="ltr"
                              value={subLang}
                              onChange={(e) => setSubLang(e.target.value)}
                              placeholder="ar"
                              className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                            />
                            <input
                              type="text"
                              value={subLangLabel}
                              onChange={(e) => setSubLangLabel(e.target.value)}
                              placeholder="العربية"
                              className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                            />
                          </div>
                          {subCues.map((cue, idx) => (
                            <div key={cue.id} className="grid grid-cols-12 gap-1.5">
                              <input
                                type="text"
                                dir="ltr"
                                value={cue.start}
                                onChange={(e) =>
                                  setSubCues(subCues.map((c, i) => (i === idx ? { ...c, start: e.target.value } : c)))
                                }
                                className="col-span-3 rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] font-mono"
                              />
                              <input
                                type="text"
                                dir="ltr"
                                value={cue.end}
                                onChange={(e) =>
                                  setSubCues(subCues.map((c, i) => (i === idx ? { ...c, end: e.target.value } : c)))
                                }
                                className="col-span-3 rounded border border-neutral-300 bg-white px-2 py-1 text-[11px] font-mono"
                              />
                              <input
                                type="text"
                                value={cue.text}
                                onChange={(e) =>
                                  setSubCues(subCues.map((c, i) => (i === idx ? { ...c, text: e.target.value } : c)))
                                }
                                placeholder="نص الترجمة..."
                                className="col-span-6 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                              />
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setSubCues([
                                ...subCues,
                                { id: `c-${Date.now()}`, start: '00:00:05.000', end: '00:00:10.000', text: '' },
                              ])
                            }
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#8C6A2F] cursor-pointer"
                          >
                            <Plus size={12} /> سطر ترجمة إضافي
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {publishError && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-red-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">لم يتم النشر — جميع بياناتك والفيديو المرفوع محفوظة دون فقدان</div>
                    <div className="mt-0.5 text-red-700">{publishError}</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => handlePublish()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>إعادة محاولة النشر الآن</span>
                </button>
              </div>
            )}

            {publishedSuccess && (
              <div className="rounded-xl border border-[#B08D45] bg-[#F7F4EC] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#171717]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-[#8C6A2F] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      تم التحقق من حفظ المادة "{publishedSuccess.title}" ({publishedSuccess.status === 'published' ? 'منشورة الآن' : 'مسودة'})
                    </div>
                    {publishedSuccess.locations.length > 0 && (
                      <div className="text-[11px] text-neutral-600 mt-0.5">
                        أماكن الظهور: {publishedSuccess.locations.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
                {publishedSuccess.status === 'published' && (
                  <a
                    href={`/content/${encodeURIComponent(publishedSuccess.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white font-bold hover:bg-[#8C6A2F]"
                  >
                    <ExternalLink size={13} />
                    <span>عرض المادة على الموقع العام</span>
                  </a>
                )}
              </div>
            )}

            {/* Publish Actions Bar */}
            <div className="pt-3 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="published">نشر فوري</option>
                  <option value="draft">حفظ كمسودة</option>
                  <option value="scheduled">جدولة النشر</option>
                  <option value="hidden">منشور مخفي</option>
                </select>
                {form.status === 'scheduled' && (
                  <input
                    type="datetime-local"
                    value={form.scheduled_at}
                    onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => handlePublish('draft')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-neutral-800 hover:bg-neutral-50 cursor-pointer disabled:opacity-60"
                >
                  <Save size={14} />
                  <span>حفظ كمسودة</span>
                </button>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => handlePublish(form.status === 'scheduled' ? 'scheduled' : 'published')}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer disabled:opacity-60"
                >
                  <Rocket size={14} />
                  <span>
                    {publishing
                      ? 'جاري النشر والتحقق...'
                      : form.status === 'scheduled'
                        ? 'جدولة النشر'
                        : 'نشر المادة على الموقع'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Upload Sessions History */}
        <AdminCard title="سجل جلسات الرفع المجزأ">
          {sessions.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-500">لا توجد جلسات رفع مسجلة بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 bg-neutral-50">
                    <th className="p-2.5">اسم الملف</th>
                    <th className="p-2.5">الحجم</th>
                    <th className="p-2.5">الأجزاء</th>
                    <th className="p-2.5">الحالة</th>
                    <th className="p-2.5">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="p-2.5 font-semibold text-neutral-900">{s.original_name}</td>
                      <td className="p-2.5 tabular-nums">{formatBytes(s.total_size)}</td>
                      <td className="p-2.5 tabular-nums">
                        {JSON.parse(s.received_chunks_json || '[]').length}/{s.total_chunks}
                      </td>
                      <td className="p-2.5">{s.status}</td>
                      <td className="p-2.5 tabular-nums text-neutral-500">
                        {formatArabicDate(s.created_at, 'arabic')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>

      {/* Lightbox for inspecting & selecting any extracted thumbnail */}
      {lightboxThumb && (() => {
        const currentIdx = thumbs.findIndex((t) => t.url === lightboxThumb);
        const currentThumbObj = currentIdx >= 0 ? thumbs[currentIdx] : null;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
            onClick={() => setLightboxThumb(null)}
          >
            <div
              className="relative max-w-4xl w-full bg-neutral-950 rounded-2xl overflow-hidden border border-white/15 p-4 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-white">
                <div className="text-xs font-bold tabular-nums">
                  {currentThumbObj
                    ? currentThumbObj.isCustom
                      ? 'صورة غلاف مخصصة'
                      : `إطار #${currentThumbObj.index || currentIdx + 1} من ${thumbs.length} — الثانية ${currentThumbObj.timestamp}s`
                    : 'معاينة الصورة المصغرة'}
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxThumb(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative flex items-center justify-center bg-black rounded-xl overflow-hidden">
                <img src={lightboxThumb} alt="" className="w-full max-h-[72vh] object-contain" />
                {thumbs.length > 1 && currentIdx >= 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxThumb(thumbs[(currentIdx - 1 + thumbs.length) % thumbs.length].url)
                      }
                      className="absolute right-3 p-2 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxThumb(thumbs[(currentIdx + 1) % thumbs.length].url)
                      }
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
                    selectThumbnail(lightboxThumb);
                    setLightboxThumb(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
                >
                  <Check size={14} />
                  <span>اعتماد هذه الصورة المصغرة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxThumb(null)}
                  className="px-4 py-2 rounded-lg border border-white/20 text-white text-xs font-semibold hover:bg-white/10 cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live Preview Modal */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Film size={16} className="text-[#B08D45]" />
                <span>معاينة ظهور المادة قبل النشر</span>
              </div>
              <button type="button" onClick={() => setShowPreviewModal(false)} className="cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <MediaCard item={previewItem} variant="editorial" />
          </div>
        </div>
      )}
    </div>
  );
}
