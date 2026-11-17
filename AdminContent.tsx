import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Maximize2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AdminCard,
  AdminPanelHeader,
  ColorField,
  GradientEditor,
} from '../../../components/admin/AdminSharedUI';
import { VideoThumbnailSelector } from '../../../components/admin/VideoThumbnailSelector';
import { OfficialAccountAttribution } from '../../../components/OfficialAccountAttribution';
import { useAdmin } from '../../../context/AdminContext';
import { usePlatform } from '../../../context/PlatformContext';
import { CONTENT_TYPE_LABELS, formatArabicDate, STATUS_LABELS } from '../../../lib/styleEngine';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { ContentRecord, GradientConfig, InfoCardFieldConfig, MediaFileRecord } from '../../../types/platform';

function createDefaultTitleGradient(): GradientConfig {
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

export function AdminContent() {
  const { content, pages, mediaFiles, settings, saveCategory, refreshAll, notify } = useAdmin();
  const { refreshBootstrap } = usePlatform();

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploadingInline, setUploadingInline] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [extractedThumbs, setExtractedThumbs] = useState<
    Array<{ index?: number; url: string; timestamp: number; selected?: boolean; isCustom?: boolean }>
  >([]);
  const [extractingThumbs, setExtractingThumbs] = useState(false);
  const [lightboxThumb, setLightboxThumb] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTaxonomyModal, setShowTaxonomyModal] = useState(false);
  const [typeLabelsDraft, setTypeLabelsDraft] = useState<Record<string, string>>({});
  const [newTypeKey, setNewTypeKey] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [savingTaxonomy, setSavingTaxonomy] = useState(false);

  const contentTypeLabels = useMemo(
    () => ({
      ...CONTENT_TYPE_LABELS,
      ...(settings?.uiTexts?.contentTypeLabels || {}),
    }),
    [settings?.uiTexts?.contentTypeLabels]
  );

  const CORE_CONTENT_TYPES = ['video', 'image', 'article', 'report', 'audio', 'document'];

  const [form, setForm] = useState({
    title: '',
    slug: '',
    content_type: 'video' as ContentRecord['content_type'],
    description: '',
    body: '',
    status: 'published' as ContentRecord['status'],
    featured: false,
    showOnHome: true,
    page_id: '' as string,
    child_page_id: '' as string,
    extra_page_ids: [] as number[],
    category: '',
    tags: '',
    thumbnail_url: '',
    media_url: '',
    media_file_id: '' as string,
    link_url: '',
    link_label: '',
    link_enabled: false,
    link_new_tab: true,
    duration: 0,
    resolution: '',
    views: 0,
    source_label: settings?.identity?.siteName || 'أرشيف الشهيد',
    editor_label: '',
    scheduled_at: '',
    titleGradientMode: 'custom' as 'inherit' | 'custom' | 'disabled',
    titleGradient: createDefaultTitleGradient(),
    // Advanced per-item overrides
    allowDownload: true,
    allowShare: true,
    extBtnColor: '',
    extBtnCircleBg: '',
    relatedMaxOverride: '',
    relatedEnabledMode: 'inherit' as 'inherit' | 'enabled' | 'disabled',
    relatedSelectionMode: '' as '' | 'auto' | 'manual' | 'category',
    relatedManualIds: [] as number[],
    infoCardMode: 'inherit' as 'inherit' | 'enabled' | 'disabled',
    infoCardLayout: '' as '' | 'vertical' | 'two-column' | 'horizontal',
    infoCardPosition: '' as '' | 'left' | 'right' | 'below',
    showOfficialAccount: false,
    officialAccountPlacement: 'inherit' as 'inherit' | 'below-media' | 'below-title' | 'below-content',
    dateIsManual: false,
    customPublishedAt: '',
    titleColorOverride: '',
    borderColor: '',
    borderWidth: 0,
    borderRadius: 10,
    glowColor: '',
    altText: '',
    customFieldValues: {} as Record<string, string>,
  });

  const homePage = useMemo(
    () => pages.find((p) => p.page_type === 'home' || p.slug === 'home') || null,
    [pages]
  );
  const mainPages = useMemo(() => pages.filter((p) => !p.parent_id && p.status !== 'deleted'), [pages]);
  const childPagesForSelected = useMemo(() => {
    if (!form.page_id) return pages.filter((p) => p.parent_id !== null && p.status !== 'deleted');
    return pages.filter((p) => String(p.parent_id) === String(form.page_id) && p.status !== 'deleted');
  }, [pages, form.page_id]);

  const filteredItems = useMemo(() => {
    return content.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterType !== 'all' && c.content_type !== filterType) return false;
      if (searchQ.trim()) {
        const q = searchQ.trim().toLowerCase();
        if (!`${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [content, filterStatus, filterType, searchQ]);

  const openNew = () => {
    setEditingId(null);
    setExtractedThumbs([]);
    setAdvancedOpen(false);
    const nonHomeMain = mainPages.find((p) => p.page_type !== 'home') || mainPages[0];
    setForm({
      title: '',
      slug: '',
      content_type: 'video',
      description: '',
      body: '',
      status: 'published',
      featured: false,
      showOnHome: true,
      page_id: nonHomeMain?.id ? String(nonHomeMain.id) : '',
      child_page_id: '',
      extra_page_ids: [],
      category: '',
      tags: '',
      thumbnail_url: '',
      media_url: '',
      media_file_id: '',
      link_url: '',
      link_label: '',
      link_enabled: false,
      link_new_tab: true,
      duration: 0,
      resolution: '',
      views: 0,
      source_label: settings?.identity?.siteName || 'أرشيف الشهيد',
      editor_label: '',
      scheduled_at: '',
      titleGradientMode: 'custom',
      titleGradient: createDefaultTitleGradient(),
      allowDownload: true,
      allowShare: true,
      extBtnColor: '',
      extBtnCircleBg: '',
      relatedMaxOverride: '',
      relatedEnabledMode: 'inherit',
      relatedSelectionMode: '',
      relatedManualIds: [],
      infoCardMode: 'inherit',
      infoCardLayout: '',
      infoCardPosition: '',
      showOfficialAccount: false,
      officialAccountPlacement: 'inherit',
      dateIsManual: false,
      customPublishedAt: '',
      titleColorOverride: '',
      borderColor: '',
      borderWidth: 0,
      borderRadius: 10,
      glowColor: '',
      altText: '',
      customFieldValues: {},
    });
    setShowEditor(true);
  };

  const openEdit = (item: ContentRecord) => {
    let settingsJson: any = {};
    try {
      settingsJson = JSON.parse(item.settings_json || '{}');
    } catch {
      settingsJson = {};
    }
    let extraIds: number[] = [];
    try {
      extraIds = JSON.parse(item.extra_page_ids_json || '[]');
    } catch {
      extraIds = [];
    }
    let tagsArr: string[] = [];
    try {
      tagsArr = JSON.parse(item.tags_json || '[]');
    } catch {
      tagsArr = [];
    }
    let customMeta: Record<string, string> = {};
    try {
      customMeta = JSON.parse(item.custom_metadata_json || '{}');
    } catch {
      customMeta = {};
    }
    const fieldVals: Record<string, string> = {};
    for (const [k, v] of Object.entries(customMeta)) {
      if (k.startsWith('__field_')) fieldVals[k.slice(8)] = String(v);
    }

    const linkedMedia = mediaFiles.find((m) => m.id === item.media_file_id);
    if (linkedMedia?.thumbnails_json) {
      try {
        setExtractedThumbs(JSON.parse(linkedMedia.thumbnails_json));
      } catch {
        setExtractedThumbs([]);
      }
    } else {
      setExtractedThumbs([]);
    }

    const hasHome = homePage ? extraIds.includes(homePage.id) || item.page_id === homePage.id : false;
    const savedMode: 'inherit' | 'custom' | 'disabled' =
      settingsJson.titleGradientMode === 'disabled' ||
      settingsJson.titleStyleOverride?.gradient?.enabled === false
        ? 'disabled'
        : settingsJson.titleGradientMode === 'custom' ||
            settingsJson.titleStyleOverride?.gradient?.enabled === true
          ? 'custom'
          : 'inherit';

    setEditingId(item.id);
    setForm({
      title: item.title,
      slug: item.slug,
      content_type: item.content_type,
      description: item.description || '',
      body: item.body || '',
      status: item.status,
      featured: Boolean(item.featured),
      showOnHome: hasHome,
      page_id: item.page_id ? String(item.page_id) : '',
      child_page_id: item.child_page_id ? String(item.child_page_id) : '',
      extra_page_ids: homePage ? extraIds.filter((eid) => eid !== homePage.id) : extraIds,
      category: item.category || '',
      tags: tagsArr.join('، '),
      thumbnail_url: item.thumbnail_url || '',
      media_url: item.media_url || '',
      media_file_id: item.media_file_id ? String(item.media_file_id) : '',
      link_url: item.link_url || '',
      link_label: item.link_label || settingsJson.linkLabel || '',
      link_enabled: Boolean(item.link_enabled),
      link_new_tab: Boolean(item.link_new_tab),
      duration: item.duration || 0,
      resolution: item.resolution || '',
      views: item.views || 0,
      source_label: item.source_label || '',
      editor_label: item.editor_label || '',
      scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0, 16) : '',
      titleGradientMode: savedMode,
      titleGradient: settingsJson.titleStyleOverride?.gradient
        ? { ...createDefaultTitleGradient(), ...settingsJson.titleStyleOverride.gradient }
        : createDefaultTitleGradient(),
      allowDownload: settingsJson.allowDownload !== false,
      allowShare: settingsJson.allowShare !== false,
      extBtnColor: settingsJson.externalPlayButtonOverride?.iconColor || '',
      extBtnCircleBg: settingsJson.externalPlayButtonOverride?.circleBackground || '',
      relatedMaxOverride: settingsJson.relatedOverride?.maxItems
        ? String(settingsJson.relatedOverride.maxItems)
        : '',
      relatedEnabledMode:
        settingsJson.relatedOverride?.enabled === true
          ? 'enabled'
          : settingsJson.relatedOverride?.enabled === false
            ? 'disabled'
            : 'inherit',
      relatedSelectionMode: settingsJson.relatedOverride?.selectionMode || '',
      relatedManualIds: Array.isArray(settingsJson.relatedOverride?.manualIds)
        ? settingsJson.relatedOverride.manualIds
        : [],
      infoCardMode:
        settingsJson.infoCardOverride?.enabled === true
          ? 'enabled'
          : settingsJson.infoCardOverride?.enabled === false
            ? 'disabled'
            : 'inherit',
      infoCardLayout: settingsJson.infoCardOverride?.layout || '',
      infoCardPosition: settingsJson.infoCardOverride?.position || '',
      showOfficialAccount: Boolean(settingsJson.showOfficialAccount),
      officialAccountPlacement: settingsJson.officialAccountPlacement || 'inherit',
      dateIsManual: Boolean(settingsJson.dateIsManual),
      customPublishedAt: settingsJson.customPublishedAt || '',
      titleColorOverride: settingsJson.titleStyleOverride?.color || '',
      borderColor: settingsJson.borderColor || '',
      borderWidth: settingsJson.borderWidth || 0,
      borderRadius: settingsJson.borderRadius || 10,
      glowColor: settingsJson.glowColor || '',
      altText: settingsJson.altText || '',
      customFieldValues: fieldVals,
    });
    setShowEditor(true);
  };

  const reExtractThumbsForMedia = async (mediaId: string | number) => {
    setExtractingThumbs(true);
    try {
      const res = await fetch(`/api/admin/media/${mediaId}/extract-thumbnails`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر استخراج الصور المصغرة');
      const frames = Array.isArray(data.frames) ? data.frames : [];
      setExtractedThumbs(frames);
      if (frames[0]?.url) {
        setForm((prev) => ({ ...prev, thumbnail_url: prev.thumbnail_url || frames[0].url }));
      }
      await refreshAll();
      notify(data.warning || `تم استخراج ${frames.length} صور مصغرة بنجاح`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل استخراج الصور المصغرة', 'error');
    } finally {
      setExtractingThumbs(false);
    }
  };


  const handleFileUpload = async (file: File, target: 'media' | 'thumbnail') => {
    setUploadingInline(true);
    setUploadPct(0);
    try {
      const res = await uploadFileInChunks(file, (p) => setUploadPct(p.percent));
      const m: MediaFileRecord = res.media;
      if (target === 'thumbnail') {
        setForm((prev) => ({ ...prev, thumbnail_url: m.public_url }));
        if (form.media_file_id) {
          const customRes = await fetch(`/api/admin/media/${form.media_file_id}/custom-thumbnail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ url: m.public_url, applyToLinkedContent: false }),
          });
          if (customRes.ok) {
            const customData = await customRes.json();
            if (Array.isArray(customData.frames)) setExtractedThumbs(customData.frames);
          }
        }
        notify('تم رفع وتعيين الصورة المصغرة');
      } else {
        let thumbs: Array<{ index?: number; url: string; timestamp: number; selected?: boolean; isCustom?: boolean }> = [];
        try {
          thumbs = JSON.parse(m.thumbnails_json || '[]');
        } catch {
          thumbs = [];
        }
        setExtractedThumbs(thumbs);
        const preferred = thumbs.find((t) => t.selected)?.url || thumbs[0]?.url || '';
        setForm((prev) => ({
          ...prev,
          media_url: m.public_url,
          media_file_id: String(m.id),
          duration: m.duration || prev.duration,
          resolution: m.height ? `${m.height}p` : prev.resolution,
          thumbnail_url:
            prev.thumbnail_url ||
            preferred ||
            (m.media_kind === 'image' ? m.public_url : ''),
          title: prev.title || m.original_name.replace(/\.[^.]+$/, ''),
        }));
        if (m.media_kind === 'video' && thumbs.filter((t) => !t.isCustom).length < 6) {
          await reExtractThumbsForMedia(m.id);
        } else if (res.thumbnailWarning) {
          notify(res.thumbnailWarning, 'info');
        } else {
          notify(res.duplicate ? 'تم ربط الملف الموجود مسبقاً دون تكرار' : 'تم رفع الملف ومعالجته بنجاح');
        }
      }
      await refreshAll();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الملف', 'error');
    } finally {
      setUploadingInline(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      notify('عنوان المادة مطلوب', 'error');
      return;
    }
    setSaving(true);
    try {
      const customMeta: Record<string, string> = {};
      for (const [k, v] of Object.entries(form.customFieldValues)) {
        if (v !== undefined && v !== '') customMeta[`__field_${k}`] = v;
      }

      const combinedExtraIds = Array.from(
        new Set([
          ...form.extra_page_ids,
          ...(form.showOnHome && homePage ? [homePage.id] : []),
        ])
      ).filter((id) => !(homePage && !form.showOnHome && id === homePage.id));

      const baseColor = form.titleColorOverride ? { color: form.titleColorOverride } : {};
      const titleGradientPayload =
        form.titleGradientMode === 'disabled'
          ? {
              titleGradientMode: 'disabled',
              titleStyleOverride: {
                ...baseColor,
                disableTargetGradient: true,
                gradient: { ...form.titleGradient, enabled: false },
              },
            }
          : form.titleGradientMode === 'custom'
            ? {
                titleGradientMode: 'custom',
                titleStyleOverride: {
                  ...baseColor,
                  disableTargetGradient: false,
                  gradient: { ...form.titleGradient, enabled: true },
                },
              }
            : {
                titleGradientMode: 'inherit',
                ...(form.titleColorOverride ? { titleStyleOverride: { ...baseColor } } : {}),
              };

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
        ...titleGradientPayload,
      };
      if (form.extBtnColor || form.extBtnCircleBg) {
        settingsObj.externalPlayButtonOverride = {
          ...(form.extBtnColor ? { iconColor: form.extBtnColor } : {}),
          ...(form.extBtnCircleBg ? { circleBackground: form.extBtnCircleBg } : {}),
        };
      }
      if (
        form.relatedMaxOverride ||
        form.relatedEnabledMode !== 'inherit' ||
        form.relatedSelectionMode ||
        form.relatedManualIds.length > 0
      ) {
        settingsObj.relatedOverride = {
          ...(form.relatedMaxOverride ? { maxItems: Number(form.relatedMaxOverride) } : {}),
          ...(form.relatedEnabledMode !== 'inherit'
            ? { enabled: form.relatedEnabledMode === 'enabled' }
            : {}),
          ...(form.relatedSelectionMode ? { selectionMode: form.relatedSelectionMode } : {}),
          ...(form.relatedManualIds.length > 0 ? { manualIds: form.relatedManualIds } : {}),
        };
      }
      if (form.infoCardMode !== 'inherit' || form.infoCardLayout || form.infoCardPosition) {
        settingsObj.infoCardOverride = {
          ...(form.infoCardMode !== 'inherit' ? { enabled: form.infoCardMode === 'enabled' } : {}),
          ...(form.infoCardLayout ? { layout: form.infoCardLayout } : {}),
          ...(form.infoCardPosition ? { position: form.infoCardPosition } : {}),
        };
      }

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        content_type: form.content_type,
        description: form.description,
        body: form.body,
        status: form.status,
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
        media_file_id: form.media_file_id ? Number(form.media_file_id) : null,
        link_url: form.link_url,
        link_label: form.link_label,
        link_enabled: form.link_enabled,
        link_new_tab: form.link_new_tab,
        duration: form.duration,
        resolution: form.resolution,
        views: Number(form.views || 0),
        source_label: form.source_label,
        editor_label: form.editor_label,
        custom_metadata: customMeta,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        settings: settingsObj,
      };

      const url = editingId ? `/api/admin/content/${editingId}` : '/api/admin/content';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.item?.id) {
        throw new Error(data.error || 'فشل حفظ المادة في قاعدة البيانات');
      }
      if (form.media_file_id && form.thumbnail_url) {
        await fetch(`/api/admin/media/${form.media_file_id}/select-thumbnail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ url: form.thumbnail_url, applyToLinkedContent: false }),
        }).catch(() => {});
      }
      await refreshAll();
      await refreshBootstrap();
      notify(editingId ? 'تم تحديث المادة وحفظ الإعدادات بنجاح' : 'تم حفظ ونشر المادة بنجاح');
      setShowEditor(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حفظ المادة', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBulk = async (action: string) => {
    if (selectedIds.length === 0) return;
    await fetch('/api/admin/content/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, ids: selectedIds }),
    });
    setSelectedIds([]);
    await refreshAll();
    await refreshBootstrap();
    notify('تم تنفيذ الإجراء الجماعي بنجاح');
  };

  const deleteItem = async (id: number) => {
    await fetch(`/api/admin/content/${id}`, { method: 'DELETE', credentials: 'include' });
    await refreshAll();
    await refreshBootstrap();
    notify('تم حذف المادة');
  };

  const quickStatus = async (item: ContentRecord, status: ContentRecord['status']) => {
    await fetch(`/api/admin/content/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    await refreshAll();
    await refreshBootstrap();
    notify(`تم تغيير الحالة إلى: ${STATUS_LABELS[status]}`);
  };

  const duplicateItem = async (id: number) => {
    const res = await fetch(`/api/admin/content/${id}/duplicate`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await refreshAll();
      await refreshBootstrap();
      notify('تم تكرار المادة كمسودة بنجاح');
    } else {
      notify('تعذر تكرار المادة', 'error');
    }
  };

  const globalCustomFields = (settings?.infoCard?.fields || []).filter(
    (f) => !f.deleted && f.key.startsWith('custom_')
  );

  return (
    <div>
      <AdminPanelHeader
        title="إدارة المحتوى والنشر المركزي"
        subtitle="نشر وتحرير الفيديوهات، الصور، المقالات، التقارير، الصوتيات والوثائق مع التحكم الكامل بالتاريخ وتوثيق الحساب الرسمي والروابط المخصصة."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTypeLabelsDraft({ ...contentTypeLabels });
                setShowTaxonomyModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 text-xs font-bold hover:bg-neutral-50 cursor-pointer"
            >
              <SlidersHorizontal size={14} />
              <span>أنواع المحتوى والحقول المخصصة</span>
            </button>
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة ونشر محتوى</span>
            </button>
          </div>
        }
      />

      {showEditor ? (
        <AdminCard
          title={editingId ? 'تحرير المادة' : 'معالج نشر محتوى جديد'}
          subtitle="اختر النوع، ارفع الملف أو حدده من المكتبة، عيّن الصفحة الرئيسية والفرعية، واضبط الإعدادات المتقدمة."
        >
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <label className="block text-xs font-semibold text-neutral-700 mb-1">حالة النشر</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="published">نشر فوري</option>
                  <option value="draft">مسودة</option>
                  <option value="unpublished">غير منشور</option>
                  <option value="scheduled">مجدول</option>
                  <option value="hidden">مخفي</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">التصنيف</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="مثال: وثائقي ميداني"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            {form.status === 'scheduled' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">موعد النشر المجدول</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">العنوان</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="أدخل عنوان المادة"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الرابط المختصر (Slug)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="اختياري — يُولّد تلقائياً"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F4EC] border border-[#E8E0D0] flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-[#171717] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnHome}
                  onChange={(e) => setForm({ ...form, showOnHome: e.target.checked })}
                  className="accent-[#B08D45] h-4 w-4"
                />
                <span>عرض المادة في الصفحة الرئيسية</span>
              </label>
              <span className="text-[11px] text-[#8C6A2F] font-semibold">
                {form.showOnHome ? 'مُضمّن في الصفحة الرئيسية' : 'غير مُضمّن يدوياً في الرئيسية'}
              </span>
            </div>

            {/* Central Hierarchical Page Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1">الصفحة الرئيسية</label>
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
                  <option value="">-- اختر الصفحة الرئيسية --</option>
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
                  {childPagesForSelected.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {pages.filter((p) => p.status !== 'deleted' && p.page_type !== 'home').length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  صفحات إضافية تظهر فيها المادة:
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

            {/* Upload or Select Media */}
            <div className="p-4 rounded-xl border border-neutral-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-neutral-800">ملف الوسائط الرئيسي</div>
                  <div className="text-[11px] text-neutral-500">
                    ارفع فيديو أو صورة أو ملفاً عبر الرفع المجزأ الموثوق أو اختر من المكتبة
                  </div>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F7F4EC] text-[#8C6A2F] border border-[#B08D45]/40 text-xs font-bold cursor-pointer hover:bg-[#E8E0D0]">
                  <Upload size={14} />
                  <span>رفع ملف الآن</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f, 'media');
                    }}
                  />
                </label>
              </div>

              {uploadingInline && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                    <div className="h-full bg-[#B08D45] transition-all" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <div className="text-[11px] text-neutral-600 tabular-nums">جاري الرفع... {uploadPct}%</div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    اختيار من الملفات المرفوعة
                  </label>
                  <select
                    value={form.media_file_id}
                    onChange={(e) => {
                      const mf = mediaFiles.find((m) => String(m.id) === e.target.value);
                      if (mf) {
                        let thumbs: any[] = [];
                        try {
                          thumbs = JSON.parse(mf.thumbnails_json || '[]');
                        } catch {
                          thumbs = [];
                        }
                        setExtractedThumbs(thumbs);
                        const preferred = thumbs.find((t) => t.selected)?.url || thumbs[0]?.url || '';
                        setForm((prev) => ({
                          ...prev,
                          media_file_id: String(mf.id),
                          media_url: mf.public_url,
                          duration: mf.duration || prev.duration,
                          resolution: mf.height ? `${mf.height}p` : prev.resolution,
                          thumbnail_url:
                            prev.thumbnail_url || preferred || (mf.media_kind === 'image' ? mf.public_url : ''),
                        }));
                        if (mf.media_kind === 'video' && thumbs.filter((t) => !t.isCustom).length < 6) {
                          reExtractThumbsForMedia(mf.id);
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-xs"
                  >
                    <option value="">-- اختر ملفاً --</option>
                    {mediaFiles.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.original_name} ({m.media_kind})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    رابط الوسائط المباشر
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.media_url}
                    onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {form.media_file_id && (() => {
                const selectedMedia = mediaFiles.find((m) => String(m.id) === form.media_file_id);
                if (!selectedMedia || selectedMedia.media_kind !== 'video') return null;
                return (
                  <div className="pt-2 space-y-2">
                    {extractingThumbs && (
                      <div className="p-2.5 rounded-xl bg-[#F7F4EC] border border-[#B08D45]/30 text-xs font-semibold text-[#8C6A2F] flex items-center gap-2">
                        <RefreshCw size={13} className="animate-spin" />
                        <span>جاري استخراج الإطارات الحقيقية من الفيديو...</span>
                      </div>
                    )}
                    <VideoThumbnailSelector
                      media={selectedMedia}
                      savedThumbnailUrl={form.thumbnail_url}
                      onConfirmThumbnail={async (url, updatedMedia) => {
                        setForm((prev) => ({ ...prev, thumbnail_url: url }));
                        if (updatedMedia) {
                          try {
                            setExtractedThumbs(JSON.parse(updatedMedia.thumbnails_json || '[]'));
                          } catch {}
                        }
                        await refreshAll();
                        await refreshBootstrap();
                      }}
                      onClearThumbnail={async () => {
                        setForm((prev) => ({ ...prev, thumbnail_url: '' }));
                        setExtractedThumbs([]);
                        await refreshAll();
                        await refreshBootstrap();
                      }}
                      onMediaUpdated={(updatedMedia) => {
                        try {
                          setExtractedThumbs(JSON.parse(updatedMedia.thumbnails_json || '[]'));
                        } catch {}
                      }}
                      onNotify={notify}
                      onOpenLightbox={(url) => setLightboxThumb(url)}
                    />
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    رابط الصورة المصغرة / الغلاف
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.thumbnail_url}
                    onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer hover:bg-neutral-50">
                    <Upload size={13} />
                    <span>رفع صورة غلاف مخصصة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'thumbnail');
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Clickable Destination URL */}
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">رابط الانتقال عند النقر (للصور والبطاقات)</span>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.link_enabled}
                    onChange={(e) => setForm({ ...form, link_enabled: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>تفعيل النقر على الصورة</span>
                </label>
              </div>
              {form.link_enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    dir="ltr"
                    value={form.link_url}
                    onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                    placeholder="https://example.com أو /p/videos"
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={form.link_label}
                    onChange={(e) => setForm({ ...form, link_label: e.target.value })}
                    placeholder="نص الرابط (اختياري)"
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs"
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

            {/* Per-Item Animated Title Colors Configuration */}
            <div className="rounded-xl border border-[#E8E0D0] bg-[#F7F4EC]/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-[#B08D45]" />
                  <div>
                    <h4 className="text-xs font-extrabold text-neutral-900">
                      ألوان وتدرج العنوان المتحرك لهذه المادة
                    </h4>
                    <p className="text-[11px] text-neutral-600">
                      تتحكم هذه الخيارات بألوان وحركة العنوان الظاهر على البطاقة وصفحة العرض العامة.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'custom', label: 'تدرج متحرك مخصص' },
                      { id: 'inherit', label: 'إعدادات الموقع العامة' },
                      { id: 'disabled', label: 'لون ثابت (بدون حركة)' },
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
                  title="ألوان، اتجاه، سرعة، وحركة العنوان"
                  previewText={form.title || 'معاينة عنوان المادة'}
                />
              )}
            </div>

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
              <label className="block text-xs font-semibold text-neutral-700 mb-1">النص الكامل / المقال</label>
              <textarea
                rows={5}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
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

            {/* Expandable الإعدادات المتقدمة */}
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="w-full px-4 py-3 bg-neutral-50 flex items-center justify-between text-xs font-extrabold text-neutral-900 cursor-pointer"
              >
                <span>الإعدادات المتقدمة (التاريخ اليدوي، حقول البطاقة المخصصة، المشغل، والألوان)</span>
                {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {advancedOpen && (
                <div className="p-4 space-y-4 border-t border-neutral-200 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">المصدر</label>
                      <input
                        type="text"
                        value={form.source_label}
                        onChange={(e) => setForm({ ...form, source_label: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">المحرر</label>
                      <input
                        type="text"
                        value={form.editor_label}
                        onChange={(e) => setForm({ ...form, editor_label: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الوسوم (مفصولة بفاصلة)</label>
                      <input
                        type="text"
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Manual Date Override */}
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.dateIsManual}
                        onChange={(e) => setForm({ ...form, dateIsManual: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>كتابة التاريخ يدوياً</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-neutral-200">
                        {form.dateIsManual ? 'يدوي' : 'تلقائي'}
                      </span>
                    </label>
                    {form.dateIsManual && (
                      <input
                        type="text"
                        value={form.customPublishedAt}
                        onChange={(e) => setForm({ ...form, customPublishedAt: e.target.value })}
                        placeholder="أدخل نص التاريخ..."
                        className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    )}
                  </div>

                  {globalCustomFields.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {globalCustomFields.map((f) => (
                        <div key={f.key}>
                          <label className="block text-xs font-semibold mb-1">{f.label}</label>
                          <input
                            type="text"
                            value={form.customFieldValues[f.key] || ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                customFieldValues: { ...form.customFieldValues, [f.key]: e.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.featured}
                        onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>مادة مميزة</span>
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
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">حد المحتوى المشابه</label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={form.relatedMaxOverride}
                        onChange={(e) => setForm({ ...form, relatedMaxOverride: e.target.value })}
                        placeholder="الافتراضي"
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                  </div>

                  {/* InfoCard & Related Content Per-Item Overrides */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200">
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-neutral-800">تخصيص بطاقة المعلومات لهذه المادة</div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={form.infoCardMode}
                          onChange={(e) => setForm({ ...form, infoCardMode: e.target.value as any })}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="inherit">الحالة: افتراضي</option>
                          <option value="enabled">إظهار البطاقة</option>
                          <option value="disabled">إخفاء البطاقة</option>
                        </select>
                        <select
                          value={form.infoCardLayout}
                          onChange={(e) => setForm({ ...form, infoCardLayout: e.target.value as any })}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="">النمط: افتراضي</option>
                          <option value="vertical">عمودي (أسطر)</option>
                          <option value="two-column">عمودان</option>
                          <option value="horizontal">صف أفقي</option>
                        </select>
                        <select
                          value={form.infoCardPosition}
                          onChange={(e) => setForm({ ...form, infoCardPosition: e.target.value as any })}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="">الموضع: افتراضي</option>
                          <option value="left">يسار</option>
                          <option value="right">يمين</option>
                          <option value="below">أسفل المشغل</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold text-neutral-800">تخصيص المحتوى المشابه لهذه المادة</div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={form.relatedEnabledMode}
                          onChange={(e) => setForm({ ...form, relatedEnabledMode: e.target.value as any })}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="inherit">الظهور: افتراضي</option>
                          <option value="enabled">تفعيل المشابه</option>
                          <option value="disabled">تعطيل المشابه</option>
                        </select>
                        <select
                          value={form.relatedSelectionMode}
                          onChange={(e) => setForm({ ...form, relatedSelectionMode: e.target.value as any })}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="">الاختيار: افتراضي</option>
                          <option value="auto">تلقائي ذكي</option>
                          <option value="category">نفس التصنيف</option>
                          <option value="manual">اختيار يدوي</option>
                        </select>
                      </div>
                      {form.relatedSelectionMode === 'manual' && (
                        <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 pt-1">
                          {content
                            .filter((c) => c.id !== editingId && c.status === 'published')
                            .slice(0, 20)
                            .map((c) => {
                              const picked = form.relatedManualIds.includes(c.id);
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      relatedManualIds: picked
                                        ? form.relatedManualIds.filter((id) => id !== c.id)
                                        : [...form.relatedManualIds, c.id],
                                    })
                                  }
                                  className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer ${
                                    picked
                                      ? 'bg-[#B08D45] text-white border-[#B08D45]'
                                      : 'bg-white text-neutral-700 border-neutral-300'
                                  }`}
                                >
                                  {c.title}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer disabled:opacity-60"
              >
                {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التحديثات' : 'نشر وحفظ المادة'}
              </button>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="px-4 py-2.5 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 cursor-pointer"
              >
                إلغاء والعودة للقائمة
              </button>
            </div>
          </form>
        </AdminCard>
      ) : (
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-neutral-100">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="بحث في المحتوى..."
                  className="pr-8 pl-3 py-1.5 rounded-lg border border-neutral-300 text-xs"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="all">كل الأنواع</option>
                {Object.entries(contentTypeLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="all">كل الحالات</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-neutral-600">محدد: {selectedIds.length}</span>
                <button type="button" onClick={() => handleBulk('published')} className="px-2.5 py-1 rounded bg-[#B08D45] text-white text-xs cursor-pointer">
                  نشر
                </button>
                <button type="button" onClick={() => handleBulk('unpublished')} className="px-2.5 py-1 rounded bg-neutral-600 text-white text-xs cursor-pointer">
                  إلغاء النشر
                </button>
                <button type="button" onClick={() => handleBulk('hidden')} className="px-2.5 py-1 rounded bg-amber-600 text-white text-xs cursor-pointer">
                  إخفاء
                </button>
                <button type="button" onClick={() => handleBulk('archived')} className="px-2.5 py-1 rounded bg-neutral-700 text-white text-xs cursor-pointer">
                  أرشفة
                </button>
                <button type="button" onClick={() => handleBulk('delete')} className="px-2.5 py-1 rounded bg-red-600 text-white text-xs cursor-pointer">
                  حذف
                </button>
              </div>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <p className="text-sm text-neutral-500">لا توجد مواد مطابقة حالياً.</p>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>أضف أول مادة</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500 bg-neutral-50">
                    <th className="p-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? filteredItems.map((i) => i.id) : [])
                        }
                      />
                    </th>
                    <th className="p-2.5">العنوان</th>
                    <th className="p-2.5">النوع</th>
                    <th className="p-2.5">الصفحة</th>
                    <th className="p-2.5">الحالة</th>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50">
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked
                                ? [...prev, item.id]
                                : prev.filter((id) => id !== item.id)
                            )
                          }
                        />
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2.5">
                          {item.thumbnail_url && (
                            <img
                              src={item.thumbnail_url}
                              alt=""
                              className="w-12 h-8 object-cover rounded border border-neutral-200 shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-bold text-neutral-900">{item.title}</div>
                            <div className="text-[11px] text-neutral-400 font-mono" dir="ltr">
                              /content/{item.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5">{contentTypeLabels[item.content_type] || item.content_type}</td>
                      <td className="p-2.5">
                        {item.page_title || '—'}
                        {item.child_page_title ? ` / ${item.child_page_title}` : ''}
                      </td>
                      <td className="p-2.5 font-semibold">
                        <span
                          className={
                            item.status === 'published'
                              ? 'text-[#8C6A2F]'
                              : item.status === 'hidden'
                                ? 'text-amber-700'
                                : 'text-neutral-600'
                          }
                        >
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                      <td className="p-2.5 tabular-nums text-neutral-500">
                        {formatArabicDate(item.published_at || item.created_at, 'arabic')}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => openEdit(item)} title="تحرير" className="p-1.5 rounded hover:bg-blue-50 text-blue-700 cursor-pointer">
                            <Edit3 size={14} />
                          </button>
                          <button type="button" onClick={() => duplicateItem(item.id)} title="تكرار المادة" className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600 cursor-pointer">
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => quickStatus(item, item.status === 'published' ? 'hidden' : 'published')}
                            title={item.status === 'published' ? 'إخفاء' : 'نشر'}
                            className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600 cursor-pointer"
                          >
                            {item.status === 'published' ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          {item.status === 'published' && (
                            <a
                              href={`/content/${item.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="معاينة على الموقع العام"
                              className="p-1.5 rounded hover:bg-[#F7F4EC] text-[#8C6A2F]"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button type="button" onClick={() => deleteItem(item.id)} title="حذف نهائي" className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      )}

      {lightboxThumb && (() => {
        const currentIdx = extractedThumbs.findIndex((t) => t.url === lightboxThumb);
        const cur = currentIdx >= 0 ? extractedThumbs[currentIdx] : null;
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
                  {cur
                    ? cur.isCustom
                      ? 'غلاف مخصص'
                      : `إطار #${cur.index || currentIdx + 1} من ${extractedThumbs.length} — الثانية ${cur.timestamp}s`
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
                {extractedThumbs.length > 1 && currentIdx >= 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxThumb(
                          extractedThumbs[(currentIdx - 1 + extractedThumbs.length) % extractedThumbs.length].url
                        )
                      }
                      className="absolute right-3 p-2 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxThumb(extractedThumbs[(currentIdx + 1) % extractedThumbs.length].url)
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
                    setForm((prev) => ({ ...prev, thumbnail_url: lightboxThumb }));
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
      {showTaxonomyModal && settings && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowTaxonomyModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-neutral-200 max-w-3xl w-full max-h-[88vh] overflow-y-auto p-5 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">إدارة أنواع المحتوى والحقول المخصصة</h3>
                <p className="text-[11px] text-neutral-500">
                  تخصيص مسميات أنواع المواد أو إضافة أنواع وحقول بيانات مخصصة تظهر في المحرر وبطاقة المعلومات العامة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTaxonomyModal(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-neutral-800">أنواع المحتوى المعتمدة</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(typeLabelsDraft).map(([key, label]) => {
                  const isCore = CORE_CONTENT_TYPES.includes(key);
                  return (
                    <div key={key} className="flex items-center gap-2 p-2 rounded-lg border border-neutral-200 bg-neutral-50">
                      <span className="text-[11px] font-mono text-neutral-500 px-1.5 py-0.5 rounded bg-white border border-neutral-200" dir="ltr">
                        {key}
                      </span>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) =>
                          setTypeLabelsDraft((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                      />
                      {!isCore && (
                        <button
                          type="button"
                          onClick={() =>
                            setTypeLabelsDraft((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            })
                          }
                          title="حذف النوع المخصص"
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  dir="ltr"
                  value={newTypeKey}
                  onChange={(e) => setNewTypeKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="مفتاح إنجليزي (مثال: testimony)"
                  className="w-48 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
                <input
                  type="text"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="الاسم بالعربية (مثال: شهادة حية)"
                  className="flex-1 min-w-[160px] rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const key = newTypeKey.trim();
                    const lbl = newTypeLabel.trim();
                    if (!key || !lbl) {
                      notify('أدخل المفتاح والاسم بالعربية', 'error');
                      return;
                    }
                    setTypeLabelsDraft((prev) => ({ ...prev, [key]: lbl }));
                    setNewTypeKey('');
                    setNewTypeLabel('');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus size={13} />
                  <span>إضافة نوع</span>
                </button>
                <button
                  type="button"
                  disabled={savingTaxonomy}
                  onClick={async () => {
                    setSavingTaxonomy(true);
                    const ok = await saveCategory(
                      'uiTexts',
                      { ...(settings.uiTexts || {}), contentTypeLabels: typeLabelsDraft },
                      'تحديث أنواع المحتوى'
                    );
                    if (ok) {
                      await refreshBootstrap();
                      notify('تم حفظ أنواع المحتوى بنجاح');
                    }
                    setSavingTaxonomy(false);
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer disabled:opacity-50"
                >
                  <Check size={13} />
                  <span>حفظ الأنواع</span>
                </button>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 space-y-3">
              <div className="text-xs font-bold text-neutral-800">
                الحقول المخصصة لبطاقة المعلومات ({globalCustomFields.length})
              </div>
              {globalCustomFields.length === 0 ? (
                <p className="text-xs text-neutral-500">لا توجد حقول مخصصة مضافة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {globalCustomFields.map((field) => (
                    <div key={field.key} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-neutral-200 bg-neutral-50">
                      <input
                        type="text"
                        value={field.label}
                        onChange={async (e) => {
                          const nextFields = (settings.infoCard.fields || []).map((f) =>
                            f.key === field.key ? { ...f, label: e.target.value } : f
                          );
                          await saveCategory(
                            'infoCard',
                            { ...settings.infoCard, fields: nextFields },
                            'تحديث تسمية حقل مخصص'
                          );
                          await refreshBootstrap();
                        }}
                        className="flex-1 min-w-[160px] rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs"
                      />
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.visible}
                          onChange={async (e) => {
                            const nextFields = (settings.infoCard.fields || []).map((f) =>
                              f.key === field.key ? { ...f, visible: e.target.checked } : f
                            );
                            await saveCategory(
                              'infoCard',
                              { ...settings.infoCard, fields: nextFields },
                              'تغيير ظهور حقل مخصص'
                            );
                            await refreshBootstrap();
                          }}
                          className="accent-[#B08D45]"
                        />
                        <span>ظاهر في البطاقة</span>
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          const nextFields = (settings.infoCard.fields || []).filter(
                            (f) => f.key !== field.key
                          );
                          await saveCategory(
                            'infoCard',
                            { ...settings.infoCard, fields: nextFields },
                            'حذف حقل مخصص'
                          );
                          await refreshBootstrap();
                          notify('تم حذف الحقل المخصص');
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        title="حذف الحقل"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="اسم الحقل المخصص الجديد (مثال: اسم المصور / الموقع الجغرافي)"
                  className="flex-1 min-w-[220px] rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const label = newFieldLabel.trim();
                    if (!label) {
                      notify('أدخل اسم الحقل المخصص', 'error');
                      return;
                    }
                    const existing = settings.infoCard.fields || [];
                    const newField: InfoCardFieldConfig = {
                      key: `custom_${Date.now()}`,
                      label,
                      visible: true,
                      deleted: false,
                      order: existing.length + 1,
                      fontFamily: 'inherit',
                      fontSize: '0.875rem',
                      color: '#171717',
                      background: 'transparent',
                      textAlign: 'right',
                      spacing: 8,
                    };
                    const ok = await saveCategory(
                      'infoCard',
                      { ...settings.infoCard, fields: [...existing, newField] },
                      'إضافة حقل مخصص جديد'
                    );
                    if (ok) {
                      setNewFieldLabel('');
                      await refreshBootstrap();
                      notify('تمت إضافة الحقل المخصص');
                    }
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
                >
                  <Plus size={13} />
                  <span>إضافة حقل مخصص</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
