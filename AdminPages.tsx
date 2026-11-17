import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerDownLeft,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  GripVertical,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { usePlatform } from '../../../context/PlatformContext';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { PageRecord } from '../../../types/platform';

const PAGE_ICONS = [
  { value: '', label: 'بدون أيقونة' },
  { value: 'Film', label: 'فيديو (Film)' },
  { value: 'Image', label: 'صور (Image)' },
  { value: 'FileText', label: 'وثائق ومقالات (FileText)' },
  { value: 'Folder', label: 'مجلد أرشيف (Folder)' },
  { value: 'Shield', label: 'شعار توثيق (Shield)' },
  { value: 'Sparkles', label: 'مميز (Sparkles)' },
  { value: 'Globe', label: 'عام (Globe)' },
];

export function AdminPages() {
  const { pages, refreshAll, notify } = useAdmin();
  const { refreshBootstrap } = usePlatform();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [dragPageId, setDragPageId] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<Record<number, any>>({});
  const [uploadingBg, setUploadingBg] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    parent_id: '' as string,
    page_type: 'collection' as PageRecord['page_type'],
    layout: 'grid' as PageRecord['layout'],
    status: 'published' as PageRecord['status'],
    nav_visible: true,
    aggregate_children: true,
    seo_title: '',
    seo_description: '',
    custom_content: '',
    icon: '',
    bannerBg: '#080808',
    headingColor: '#FFFFFF',
    backgroundColor: '',
    backgroundImage: '',
    typographyFamily: '',
    typographyColor: '',
    decorationPattern: 'inherit',
    decorationColor: '#B08D45',
    decorationOpacity: 0.14,
    maxWidth: '1320px',
    columnsDesktop: 3,
    columnsTablet: 2,
    columnsMobile: 1,
    pageSize: 12,
    customCss: '',
    customJs: '',
    customNotice: '',
    emptyMessage: '',
    childDisplayMode: 'all' as 'all' | 'direct-only' | 'selected-children' | 'grouped',
    selectedChildIds: [] as number[],
    defaultSort: 'newest' as 'newest' | 'oldest',
    showFilters: true,
    seoCanonical: '',
    seoOgImage: '',
    seoNoIndex: false,
  });
  const [saving, setSaving] = useState(false);

  const activePages = useMemo(() => pages.filter((p) => p.status !== 'deleted'), [pages]);
  const deletedPages = useMemo(() => pages.filter((p) => p.status === 'deleted'), [pages]);

  const forbiddenParentIds = useMemo(() => {
    const blocked = new Set<number>();
    if (!editingId) return blocked;
    blocked.add(editingId);
    let added = true;
    while (added) {
      added = false;
      for (const p of activePages) {
        if (p.parent_id && blocked.has(p.parent_id) && !blocked.has(p.id)) {
          blocked.add(p.id);
          added = true;
        }
      }
    }
    return blocked;
  }, [activePages, editingId]);

  const directChildrenOfEditing = useMemo(
    () => (editingId ? activePages.filter((p) => p.parent_id === editingId) : []),
    [activePages, editingId]
  );

  const treeRows = useMemo(() => {
    const byParent = new Map<number | null, PageRecord[]>();
    const activeIds = new Set(activePages.map((p) => p.id));
    for (const p of activePages) {
      const key = p.parent_id && activeIds.has(p.parent_id) ? p.parent_id : null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(p);
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    }

    const flat: Array<{ page: PageRecord; depth: number }> = [];
    const walk = (parentId: number | null, depth: number) => {
      for (const node of byParent.get(parentId) || []) {
        flat.push({ page: node, depth });
        walk(node.id, depth + 1);
      }
    };
    walk(null, 0);
    return flat;
  }, [activePages]);

  const resetForm = (parentId = '') => {
    setEditingId(null);
    setForm({
      title: '',
      slug: '',
      parent_id: parentId,
      page_type: 'collection',
      layout: 'grid',
      status: 'published',
      nav_visible: true,
      aggregate_children: true,
      seo_title: '',
      seo_description: '',
      custom_content: '',
      icon: '',
      bannerBg: '#080808',
      headingColor: '#FFFFFF',
      backgroundColor: '',
      backgroundImage: '',
      typographyFamily: '',
      typographyColor: '',
      decorationPattern: 'inherit',
      decorationColor: '#B08D45',
      decorationOpacity: 0.14,
      maxWidth: '1320px',
      columnsDesktop: 3,
      columnsTablet: 2,
      columnsMobile: 1,
      pageSize: 12,
      customCss: '',
      customJs: '',
      customNotice: '',
      emptyMessage: '',
      childDisplayMode: 'all',
      selectedChildIds: [],
      defaultSort: 'newest',
      showFilters: true,
      seoCanonical: '',
      seoOgImage: '',
      seoNoIndex: false,
    });
  };

  const startEdit = (p: PageRecord) => {
    let ps: any = {};
    try {
      ps = JSON.parse(p.settings_json || '{}');
    } catch {
      ps = {};
    }
    setEditingId(p.id);
    setForm({
      title: p.title,
      slug: p.slug,
      parent_id: p.parent_id ? String(p.parent_id) : '',
      page_type: p.page_type,
      layout: p.layout,
      status: p.status,
      nav_visible: Boolean(p.nav_visible),
      aggregate_children: Boolean(p.aggregate_children),
      seo_title: p.seo_title || '',
      seo_description: p.seo_description || '',
      custom_content: p.custom_content || '',
      icon: ps.icon || '',
      bannerBg: ps.bannerBg || '#080808',
      headingColor: ps.headingColor || '#FFFFFF',
      backgroundColor: ps.backgroundColor || '',
      backgroundImage: ps.backgroundImage || '',
      typographyFamily: ps.typographyFamily || '',
      typographyColor: ps.typographyColor || '',
      decorationPattern: ps.decorationPattern || 'inherit',
      decorationColor: ps.decorationColor || '#B08D45',
      decorationOpacity: ps.decorationOpacity ?? 0.14,
      maxWidth: ps.maxWidth || '1320px',
      columnsDesktop: ps.columnsDesktop ?? 3,
      columnsTablet: ps.columnsTablet ?? 2,
      columnsMobile: ps.columnsMobile ?? 1,
      pageSize: ps.pageSize ?? 12,
      customCss: ps.customCss || '',
      customJs: ps.customJs || '',
      customNotice: ps.customNotice || '',
      emptyMessage: ps.emptyMessage || '',
      childDisplayMode: ps.childDisplayMode || 'all',
      selectedChildIds: Array.isArray(ps.selectedChildIds) ? ps.selectedChildIds : [],
      defaultSort: ps.defaultSort === 'oldest' ? 'oldest' : 'newest',
      showFilters: ps.showFilters !== false,
      seoCanonical: ps.seoCanonical || '',
      seoOgImage: ps.seoOgImage || '',
      seoNoIndex: Boolean(ps.seoNoIndex),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      notify('يرجى إدخال اسم الصفحة', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const prevPage = pages.find((x) => x.id === editingId);
        if (prevPage) {
          let prevPs: any = {};
          try {
            prevPs = JSON.parse(prevPage.settings_json || '{}');
          } catch {
            prevPs = {};
          }
          setSnapshots((prev) => ({
            ...prev,
            [editingId]: {
              title: prevPage.title,
              slug: prevPage.slug,
              parent_id: prevPage.parent_id,
              page_type: prevPage.page_type,
              layout: prevPage.layout,
              status: prevPage.status,
              nav_visible: prevPage.nav_visible,
              aggregate_children: prevPage.aggregate_children,
              seo_title: prevPage.seo_title,
              seo_description: prevPage.seo_description,
              custom_content: prevPage.custom_content,
              settings: prevPs,
            },
          }));
        }
      }

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        page_type: form.page_type,
        layout: form.layout,
        status: form.status === 'deleted' ? 'published' : form.status,
        nav_visible: form.nav_visible ? 1 : 0,
        aggregate_children: form.aggregate_children ? 1 : 0,
        seo_title: form.seo_title,
        seo_description: form.seo_description,
        custom_content: form.custom_content,
        settings: {
          icon: form.icon,
          bannerBg: form.bannerBg,
          headingColor: form.headingColor,
          backgroundColor: form.backgroundColor,
          backgroundImage: form.backgroundImage,
          typographyFamily: form.typographyFamily,
          typographyColor: form.typographyColor,
          decorationPattern: form.decorationPattern,
          decorationColor: form.decorationColor,
          decorationOpacity: form.decorationOpacity,
          maxWidth: form.maxWidth,
          columnsDesktop: Number(form.columnsDesktop || 3),
          columnsTablet: Number(form.columnsTablet || 2),
          columnsMobile: Number(form.columnsMobile || 1),
          pageSize: Number(form.pageSize || 12),
          customCss: form.customCss,
          customJs: form.customJs,
          customNotice: form.customNotice,
          emptyMessage: form.emptyMessage,
          childDisplayMode: form.childDisplayMode,
          selectedChildIds: form.selectedChildIds,
          defaultSort: form.defaultSort,
          showFilters: form.showFilters,
          seoCanonical: form.seoCanonical,
          seoOgImage: form.seoOgImage,
          seoNoIndex: form.seoNoIndex,
        },
      };

      const url = editingId ? `/api/admin/pages/${editingId}` : '/api/admin/pages';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل حفظ الصفحة');
      }
      await refreshAll();
      await refreshBootstrap();
      notify(editingId ? 'تم تحديث الصفحة بنجاح' : 'تم إنشاء الصفحة بنجاح');
      if (!editingId) resetForm();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حفظ الصفحة', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRestorePreviousEdit = async (pageId: number) => {
    const snap = snapshots[pageId];
    if (!snap) return;
    const res = await fetch(`/api/admin/pages/${pageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(snap),
    });
    if (res.ok) {
      await refreshAll();
      await refreshBootstrap();
      const updated = pages.find((x) => x.id === pageId);
      if (updated) startEdit({ ...updated, ...snap, settings_json: JSON.stringify(snap.settings || {}) });
      notify('تم التراجع واستعادة النسخة السابقة للصفحة');
    }
  };

  const handleDuplicatePage = async (p: PageRecord) => {
    const res = await fetch(`/api/admin/pages/${p.id}/duplicate`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await refreshAll();
      await refreshBootstrap();
      notify(`تم نسخ الصفحة "${p.title}" بنجاح`);
    } else {
      notify('تعذر نسخ الصفحة', 'error');
    }
  };

  const handleDropPage = async (targetPage: PageRecord) => {
    if (!dragPageId || dragPageId === targetPage.id) return;
    const dragged = activePages.find((x) => x.id === dragPageId);
    setDragPageId(null);
    if (!dragged) return;
    const targetParent = targetPage.parent_id ?? null;
    const siblings = activePages
      .filter((x) => (x.parent_id ?? null) === targetParent && x.id !== dragged.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const targetIdx = siblings.findIndex((x) => x.id === targetPage.id);
    siblings.splice(targetIdx >= 0 ? targetIdx : siblings.length, 0, {
      ...dragged,
      parent_id: targetParent,
    });
    const items = siblings.map((s, idx) => ({
      id: s.id,
      sort_order: idx + 1,
      parent_id: targetParent,
    }));
    const res = await fetch('/api/admin/pages/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      await refreshAll();
      await refreshBootstrap();
      notify('تم تحديث ترتيب الصفحات بالسحب والإفلات');
    }
  };

  const handleBgImageUpload = async (file: File) => {
    setUploadingBg(true);
    try {
      const up = await uploadFileInChunks(file);
      setForm((prev) => ({ ...prev, backgroundImage: up.media.public_url }));
      notify('تم رفع صورة خلفية الصفحة بنجاح');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع صورة الخلفية', 'error');
    } finally {
      setUploadingBg(false);
    }
  };

  const toggleStatus = async (p: PageRecord) => {
    const next = p.status === 'published' ? 'hidden' : 'published';
    await fetch(`/api/admin/pages/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: next }),
    });
    await refreshAll();
    await refreshBootstrap();
    notify(next === 'published' ? 'تم نشر الصفحة' : 'تم إخفاء الصفحة');
  };

  const moveOrder = async (p: PageRecord, delta: number) => {
    const siblings = activePages
      .filter((x) => (x.parent_id ?? null) === (p.parent_id ?? null))
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const idx = siblings.findIndex((x) => x.id === p.id);
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const swap = siblings[targetIdx];
    await fetch('/api/admin/pages/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        items: [
          { id: p.id, sort_order: targetIdx + 1, parent_id: p.parent_id },
          { id: swap.id, sort_order: idx + 1, parent_id: swap.parent_id },
        ],
      }),
    });
    await refreshAll();
    await refreshBootstrap();
  };

  const handleSoftDelete = async (p: PageRecord) => {
    const res = await fetch(`/api/admin/pages/${p.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notify(err.error || 'تعذر حذف الصفحة', 'error');
      return;
    }
    await refreshAll();
    await refreshBootstrap();
    if (editingId === p.id) resetForm();
    notify('تم نقل الصفحة إلى سلة المحذوفات (يمكنك استعادتها في أي وقت)');
  };

  const handleRestore = async (p: PageRecord) => {
    const res = await fetch(`/api/admin/pages/${p.id}/restore`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await refreshAll();
      await refreshBootstrap();
      notify('تمت استعادة الصفحة بنجاح');
    }
  };

  const handlePermanentDelete = async (p: PageRecord) => {
    const res = await fetch(`/api/admin/pages/${p.id}?permanent=1`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      await refreshAll();
      await refreshBootstrap();
      notify('تم حذف الصفحة نهائياً');
    }
  };

  return (
    <div>
      <AdminPanelHeader
        title="إدارة الصفحات والشجرة الهرمية"
        subtitle="المركز الوحيد لإنشاء الصفحات الرئيسية والفرعية المتعددة المستويات (3+ مستويات)، تخصيص ألوان وخطوط وزخارف كل صفحة، والحذف الآمن مع الاستعادة."
        actions={
          <button
            type="button"
            onClick={() => resetForm('')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
          >
            <Plus size={14} />
            <span>صفحة جديدة</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-6">
          <AdminCard title={`شجرة الصفحات النشطة (${activePages.length})`}>
            <div className="divide-y divide-neutral-100">
              {treeRows.map(({ page, depth }) => (
                <div
                  key={page.id}
                  draggable={page.slug !== 'home'}
                  onDragStart={() => setDragPageId(page.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDropPage(page)}
                  className={`py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-neutral-50 px-2 rounded-lg ${
                    dragPageId === page.id ? 'opacity-50 bg-[#F7F4EC]' : ''
                  }`}
                  style={{ paddingRight: `${depth * 24 + 8}px` }}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {page.slug !== 'home' && (
                      <GripVertical size={14} className="text-neutral-300 hover:text-neutral-600 cursor-grab shrink-0" />
                    )}
                    {depth > 0 && <CornerDownLeft size={14} className="text-neutral-400 shrink-0" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-900">{page.title}</span>
                        <span className="text-[11px] text-neutral-400 font-mono" dir="ltr">
                          /p/{page.slug}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        المستوى: {depth + 1} · النوع: {page.page_type} · الحالة:{' '}
                        <span
                          className={
                            page.status === 'published' ? 'text-[#8C6A2F] font-semibold' : 'text-amber-700'
                          }
                        >
                          {page.status === 'published' ? 'منشورة' : page.status === 'hidden' ? 'مخفية' : 'مسودة'}
                        </span>
                        {page.aggregate_children ? ' · تجمع محتوى الفرعيات' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <a
                      href={page.slug === 'home' ? '/' : `/p/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="معاينة الصفحة على الموقع"
                      className="p-1.5 rounded hover:bg-[#F7F4EC] text-[#8C6A2F]"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={() => resetForm(String(page.id))}
                      title="إضافة صفحة فرعية تابعة لها"
                      className="p-1.5 rounded hover:bg-[#F7F4EC] text-[#B08D45] cursor-pointer"
                    >
                      <FolderPlus size={15} />
                    </button>
                    {page.slug !== 'home' && (
                      <button
                        type="button"
                        onClick={() => handleDuplicatePage(page)}
                        title="تكرار / نسخ الصفحة"
                        className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600 cursor-pointer"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => moveOrder(page, -1)}
                      title="تحريك لأعلى"
                      className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600 cursor-pointer"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOrder(page, 1)}
                      title="تحريك لأسفل"
                      className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600 cursor-pointer"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(page)}
                      title={page.status === 'published' ? 'إخفاء' : 'نشر'}
                      className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600 cursor-pointer"
                    >
                      {page.status === 'published' ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(page)}
                      title="تعديل"
                      className="p-1.5 rounded hover:bg-blue-50 text-blue-700 cursor-pointer"
                    >
                      <Edit3 size={14} />
                    </button>
                    {page.slug !== 'home' && (
                      <button
                        type="button"
                        onClick={() => handleSoftDelete(page)}
                        title="نقل لسلة المحذوفات"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          {deletedPages.length > 0 && (
            <AdminCard title={`سلة محذوفات الصفحات (${deletedPages.length})`}>
              <div className="space-y-2">
                {deletedPages.map((dp) => (
                  <div
                    key={dp.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-red-200 bg-red-50/40 text-xs"
                  >
                    <div>
                      <span className="font-bold text-neutral-900">{dp.title}</span>
                      <span className="text-neutral-500 font-mono mr-2">/p/{dp.slug}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRestore(dp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#B08D45] text-white font-bold cursor-pointer"
                      >
                        <RotateCcw size={12} /> استعادة
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePermanentDelete(dp)}
                        className="px-2.5 py-1 rounded border border-red-300 text-red-700 font-semibold cursor-pointer"
                      >
                        حذف نهائي
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>
          )}
        </div>

        {/* Create / Edit Page Form */}
        <AdminCard
          title={editingId ? 'تعديل الصفحة المحددة' : 'إنشاء صفحة جديدة'}
          className="xl:col-span-5"
        >
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">اسم الصفحة</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: وثائقيات الميدان"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">المعرف (Slug)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="تلقائي إذا تُرك فارغاً"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الصفحة الأب</label>
                <select
                  value={form.parent_id}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-2 text-xs"
                >
                  <option value="">صفحة رئيسية (مستوى أول)</option>
                  {treeRows
                    .filter((r) => !forbiddenParentIds.has(r.page.id))
                    .map(({ page, depth }) => (
                      <option key={page.id} value={page.id}>
                        {'— '.repeat(depth)}
                        {page.title}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نوع الصفحة</label>
                <select
                  value={form.page_type}
                  onChange={(e) => setForm({ ...form, page_type: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs"
                >
                  <option value="collection">تجميعة عامة</option>
                  <option value="videos">فيديوهات</option>
                  <option value="images">صور</option>
                  <option value="articles">مقالات</option>
                  <option value="reports">تقارير</option>
                  <option value="archive">أرشيف</option>
                  <option value="poetry">صفحة قصائد (الديوان)</option>
                  <option value="static">صفحة ثابتة</option>
                  <option value="custom">مخصصة</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">التخطيط</label>
                <select
                  value={form.layout}
                  onChange={(e) => setForm({ ...form, layout: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs"
                >
                  <option value="grid">شبكة</option>
                  <option value="list">قائمة</option>
                  <option value="editorial">تحريري</option>
                  <option value="gallery">معرض</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الحالة</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs"
                >
                  <option value="published">منشورة</option>
                  <option value="draft">مسودة</option>
                  <option value="hidden">مخفية</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.nav_visible}
                  onChange={(e) => setForm({ ...form, nav_visible: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار في القائمة</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.aggregate_children}
                  onChange={(e) => setForm({ ...form, aggregate_children: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>تجميع محتوى الصفحات الفرعية</span>
              </label>
            </div>

            {/* Per-Page Visual Design Overrides */}
            <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3">
              <div className="text-xs font-bold text-neutral-800">التصميم والتخطيط الخاص بهذه الصفحة</div>
              <div className="grid grid-cols-2 gap-2.5">
                <ColorField
                  label="خلفية ترويسة الصفحة"
                  value={form.bannerBg}
                  onChange={(v) => setForm({ ...form, bannerBg: v })}
                />
                <ColorField
                  label="لون عنوان الترويسة"
                  value={form.headingColor}
                  onChange={(v) => setForm({ ...form, headingColor: v })}
                />
                <ColorField
                  label="خلفية الصفحة المخصصة"
                  value={form.backgroundColor}
                  onChange={(v) => setForm({ ...form, backgroundColor: v })}
                />
                <ColorField
                  label="لون نصوص الصفحة"
                  value={form.typographyColor}
                  onChange={(v) => setForm({ ...form, typographyColor: v })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">صورة خلفية الصفحة (URL أو رفع)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      dir="ltr"
                      value={form.backgroundImage}
                      onChange={(e) => setForm({ ...form, backgroundImage: e.target.value })}
                      placeholder="https://..."
                      className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                    />
                    <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-300 bg-white text-[11px] font-semibold cursor-pointer">
                      <Upload size={11} />
                      <span>{uploadingBg ? '...' : 'رفع'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleBgImageUpload(f);
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">أيقونة الصفحة</label>
                  <select
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                  >
                    {PAGE_ICONS.map((ic) => (
                      <option key={ic.value} value={ic.value}>
                        {ic.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">خط الصفحة</label>
                  <select
                    value={form.typographyFamily}
                    onChange={(e) => setForm({ ...form, typographyFamily: e.target.value })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="">الخط الافتراضي للمنصة</option>
                    <option value="Cairo">Cairo</option>
                    <option value="Tajawal">Tajawal</option>
                    <option value="Amiri">Amiri</option>
                    <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">زخرفة الصفحة</label>
                  <select
                    value={form.decorationPattern}
                    onChange={(e) => setForm({ ...form, decorationPattern: e.target.value })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="inherit">الافتراضي العام</option>
                    <option value="none">بدون زخرفة</option>
                    <option value="islamic-star">نجمة هندسية</option>
                    <option value="diamond-strip">شريط معينات</option>
                    <option value="geometric-grid">شبكة هندسية</option>
                    <option value="arabesque-mesh">أرابيسك</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold mb-0.5">العرض الأقصى</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={form.maxWidth}
                    onChange={(e) => setForm({ ...form, maxWidth: e.target.value })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-0.5">أعمدة (مكتب)</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={form.columnsDesktop}
                    onChange={(e) => setForm({ ...form, columnsDesktop: Number(e.target.value) })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-0.5">أعمدة (لوحي)</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={form.columnsTablet}
                    onChange={(e) => setForm({ ...form, columnsTablet: Number(e.target.value) })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-0.5">أعمدة (جوال)</label>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={form.columnsMobile}
                    onChange={(e) => setForm({ ...form, columnsMobile: Number(e.target.value) })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-0.5">عناصر/صفحة</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={form.pageSize}
                    onChange={(e) => setForm({ ...form, pageSize: Number(e.target.value) })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2.5">
              <div className="text-xs font-bold text-neutral-800">عرض محتوى الفرعيات والتصفية</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">نمط عرض الفرعيات</label>
                  <select
                    value={form.childDisplayMode}
                    onChange={(e) => setForm({ ...form, childDisplayMode: e.target.value as any })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="all">جميع محتويات الفرعيات</option>
                    <option value="direct-only">المحتوى المباشر فقط</option>
                    <option value="selected-children">فرعيات محددة فقط</option>
                    <option value="grouped">مجمّعة حسب كل صفحة فرعية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">الترتيب الافتراضي</label>
                  <select
                    value={form.defaultSort}
                    onChange={(e) => setForm({ ...form, defaultSort: e.target.value as any })}
                    className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="newest">الأحدث</option>
                    <option value="oldest">الأقدم</option>
                  </select>
                </div>
              </div>
              {form.childDisplayMode === 'selected-children' && directChildrenOfEditing.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {directChildrenOfEditing.map((ch) => {
                    const checked = form.selectedChildIds.includes(ch.id);
                    return (
                      <label
                        key={ch.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 bg-white text-[11px] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              selectedChildIds: e.target.checked
                                ? [...form.selectedChildIds, ch.id]
                                : form.selectedChildIds.filter((id) => id !== ch.id),
                            })
                          }
                          className="accent-[#B08D45]"
                        />
                        <span>{ch.title}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showFilters}
                  onChange={(e) => setForm({ ...form, showFilters: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار شريط التصفية والفرعيات للزوار</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان SEO</label>
                <input
                  type="text"
                  value={form.seo_title}
                  onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">صورة المشاركة (OG Image)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.seoOgImage}
                  onChange={(e) => setForm({ ...form, seoOgImage: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">رابط Canonical</label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.seoCanonical}
                  onChange={(e) => setForm({ ...form, seoCanonical: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold pb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.seoNoIndex}
                  onChange={(e) => setForm({ ...form, seoNoIndex: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>منع الفهرسة (noindex)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">وصف SEO</label>
              <textarea
                rows={2}
                value={form.seo_description}
                onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">تنبيه مخصص أعلى الصفحة</label>
                <input
                  type="text"
                  value={form.customNotice}
                  onChange={(e) => setForm({ ...form, customNotice: e.target.value })}
                  placeholder="اختياري..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  رسالة الصفحة عند عدم وجود منشورات
                </label>
                <input
                  type="text"
                  value={form.emptyMessage}
                  onChange={(e) => setForm({ ...form, emptyMessage: e.target.value })}
                  placeholder="اتركه فارغاً لاستخدام الرسالة العامة"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                محتوى مخصص للصفحة
              </label>
              <textarea
                rows={3}
                value={form.custom_content}
                onChange={(e) => setForm({ ...form, custom_content: e.target.value })}
                placeholder="نص تعريفي أو محتوى يظهر أعلى الصفحة..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">CSS خاص بهذه الصفحة</label>
                <textarea
                  rows={2}
                  dir="ltr"
                  value={form.customCss}
                  onChange={(e) => setForm({ ...form, customCss: e.target.value })}
                  placeholder=".page-hero { ... }"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[11px] font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 mb-1">JavaScript خاص بهذه الصفحة</label>
                <textarea
                  rows={2}
                  dir="ltr"
                  value={form.customJs}
                  onChange={(e) => setForm({ ...form, customJs: e.target.value })}
                  placeholder="// JS اختياري"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-[11px] font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 px-4 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer disabled:opacity-60"
              >
                {saving ? 'جاري الحفظ...' : editingId ? 'حفظ تعديلات الصفحة' : 'إنشاء الصفحة'}
              </button>
              {editingId && snapshots[editingId] && (
                <button
                  type="button"
                  onClick={() => handleRestorePreviousEdit(editingId)}
                  className="inline-flex items-center gap-1 py-2 px-3 rounded-lg border border-[#B08D45] text-[#8C6A2F] bg-[#F7F4EC] text-xs font-bold cursor-pointer"
                >
                  <Undo2 size={13} /> التراجع عن آخر تعديل
                </button>
              )}
              {editingId && (
                <button
                  type="button"
                  onClick={() => resetForm('')}
                  className="py-2 px-3 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}
