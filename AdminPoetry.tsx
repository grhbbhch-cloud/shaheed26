import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Edit3,
  Feather,
  Palette,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { exportPoemAsPng } from '../../../lib/poemImageExport';
import type {
  PoemDesignOverride,
  PoemRecord,
  PoetryFormCustomField,
  PoetrySettingsConfig,
} from '../../../types/platform';

const EMPTY_POEM_FORM = {
  title: '',
  slug: '',
  poet_name: '',
  intro_text: '',
  verses_text: '',
  cover_image_url: '',
  status: 'published' as PoemRecord['status'],
  pinned: false,
  sort_order: 1,
  scheduled_at: '',
  design: {} as PoemDesignOverride,
};

export function AdminPoetry() {
  const { settings, saveCategory, resetCategory, notify, refreshAll } = useAdmin();
  const [tab, setTab] = useState<'poems' | 'design'>('poems');
  const [poems, setPoems] = useState<PoemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_POEM_FORM);
  const [savingPoem, setSavingPoem] = useState(false);

  const [poetryCfg, setPoetryCfg] = useState<PoetrySettingsConfig | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    if (settings?.poetry) {
      const cloned = structuredClone(settings.poetry);
      if (!cloned.submissionForm.customFields) {
        cloned.submissionForm.customFields = [];
      }
      if (cloned.submissionForm.showPoetName === undefined) {
        cloned.submissionForm.showPoetName = true;
      }
      setPoetryCfg(cloned);
    }
  }, [settings]);

  const loadPoems = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (statusFilter !== 'all') p.set('status', statusFilter);
      if (query.trim()) p.set('q', query.trim());
      const res = await fetch(`/api/admin/poems?${p.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPoems(data.poems || []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    loadPoems();
  }, [loadPoems]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_POEM_FORM, sort_order: poems.length + 1 });
    setModalOpen(true);
  };

  const openEdit = (poem: PoemRecord) => {
    let parsedDesign: PoemDesignOverride = {};
    try {
      parsedDesign = JSON.parse(poem.design_json || '{}');
    } catch {
      parsedDesign = {};
    }
    setEditingId(poem.id);
    setForm({
      title: poem.title,
      slug: poem.slug,
      poet_name: poem.poet_name || '',
      intro_text: poem.intro_text || '',
      verses_text: poem.verses_text || '',
      cover_image_url: poem.cover_image_url || '',
      status: poem.status,
      pinned: poem.pinned === 1,
      sort_order: poem.sort_order || 1,
      scheduled_at: poem.scheduled_at ? poem.scheduled_at.slice(0, 16) : '',
      design: parsedDesign,
    });
    setModalOpen(true);
  };

  const handleSavePoem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.verses_text.trim()) {
      notify('عنوان القصيدة وأبياتها مطلوبان.', 'error');
      return;
    }
    setSavingPoem(true);
    try {
      const url = editingId ? `/api/admin/poems/${editingId}` : '/api/admin/poems';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر حفظ القصيدة.', 'error');
        return;
      }
      notify(editingId ? 'تم تحديث القصيدة بنجاح.' : 'تمت إضافة القصيدة بنجاح.', 'success');
      setModalOpen(false);
      await loadPoems();
      await refreshAll();
    } finally {
      setSavingPoem(false);
    }
  };

  const handleTogglePin = async (poem: PoemRecord) => {
    const res = await fetch(`/api/admin/poems/${poem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pinned: poem.pinned !== 1 }),
    });
    if (res.ok) {
      notify(poem.pinned === 1 ? 'تم إلغاء تثبيت القصيدة.' : 'تم تثبيت القصيدة في الأعلى.', 'success');
      await loadPoems();
    }
  };

  const handleDeletePoem = async (poem: PoemRecord) => {
    const res = await fetch(`/api/admin/poems/${poem.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      notify('تم نقل القصيدة إلى سلة المحذوفات.', 'info');
      await loadPoems();
      await refreshAll();
    }
  };

  const handleExportPng = async (poem: PoemRecord) => {
    try {
      await exportPoemAsPng(poem, settings?.poetry, settings?.identity?.siteName);
      notify('تم تصدير بطاقة القصيدة كصورة PNG عالية الدقة.', 'success');
    } catch {
      notify('تعذر تصدير الصورة.', 'error');
    }
  };

  const handleSaveCfg = async () => {
    if (!poetryCfg) return;
    setSavingCfg(true);
    try {
      await saveCategory('poetry', poetryCfg, 'تحديث تصميم صفحة قصائد وزر المشاركة ونموذج الإرسال');
    } finally {
      setSavingCfg(false);
    }
  };

  const addCustomField = () => {
    if (!poetryCfg) return;
    const next: PoetryFormCustomField = {
      id: `cf_${Date.now()}`,
      label: 'حقل إضافي جديد',
      placeholder: 'اكتب القيمة هنا...',
      type: 'text',
      required: false,
    };
    setPoetryCfg({
      ...poetryCfg,
      submissionForm: {
        ...poetryCfg.submissionForm,
        customFields: [...(poetryCfg.submissionForm.customFields || []), next],
      },
    });
  };

  const updateCustomField = (id: string, patch: Partial<PoetryFormCustomField>) => {
    if (!poetryCfg) return;
    setPoetryCfg({
      ...poetryCfg,
      submissionForm: {
        ...poetryCfg.submissionForm,
        customFields: (poetryCfg.submissionForm.customFields || []).map((f) =>
          f.id === id ? { ...f, ...patch } : f
        ),
      },
    });
  };

  const removeCustomField = (id: string) => {
    if (!poetryCfg) return;
    setPoetryCfg({
      ...poetryCfg,
      submissionForm: {
        ...poetryCfg.submissionForm,
        customFields: (poetryCfg.submissionForm.customFields || []).filter((f) => f.id !== id),
      },
    });
  };

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        title="قسم قصائد (الديوان والبطاقات الشعرية)"
        subtitle="إدارة القصائد المنشورة، تثبيتها، تخصيص تصميم صفحة /p/poems وزر «شارك» ونموذج المشاركات"
        onSave={tab === 'design' ? handleSaveCfg : undefined}
        onReset={tab === 'design' ? () => resetCategory('poetry') : undefined}
        saving={savingCfg}
        actions={
          tab === 'poems' ? (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة قصيدة جديدة</span>
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
        <button
          type="button"
          onClick={() => setTab('poems')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
            tab === 'poems'
              ? 'bg-[#B08D45] text-white'
              : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <Feather size={14} />
          <span>قائمة القصائد ({poems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('design')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
            tab === 'design'
              ? 'bg-[#B08D45] text-white'
              : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <Palette size={14} />
          <span>تصميم الصفحة وزر «شارك» ونموذج الإرسال</span>
        </button>
      </div>

      {tab === 'poems' ? (
        <AdminCard title="إدارة القصائد">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث بعنوان القصيدة أو اسم الشاعر أو الأبيات..."
                className="w-full pr-9 pl-3 py-2 rounded-lg border border-neutral-200 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
            >
              <option value="all">جميع الحالات</option>
              <option value="published">منشور</option>
              <option value="draft">مسودة</option>
              <option value="scheduled">مجدول</option>
              <option value="hidden">مخفي</option>
            </select>
          </div>

          {loading ? (
            <p className="py-10 text-center text-xs text-neutral-500">جاري تحميل القصائد...</p>
          ) : poems.length === 0 ? (
            <p className="py-10 text-center text-xs text-neutral-500">لا توجد قصائد مطابقة للبحث.</p>
          ) : (
            <div className="space-y-3">
              {poems.map((poem) => (
                <div
                  key={poem.id}
                  className="rounded-xl border border-neutral-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50/40"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-extrabold text-neutral-900">{poem.title}</h4>
                      {poem.pinned === 1 && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                          مثبتة
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          poem.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {poem.status === 'published'
                          ? 'منشورة'
                          : poem.status === 'draft'
                            ? 'مسودة'
                            : poem.status === 'scheduled'
                              ? 'مجدولة'
                              : 'مخفية'}
                      </span>
                      {poem.poet_name && (
                        <span className="text-xs text-[#8C6A2F] font-semibold">— {poem.poet_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-600 line-clamp-2 whitespace-pre-line">
                      {poem.verses_text}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePin(poem)}
                      title={poem.pinned === 1 ? 'إلغاء التثبيت' : 'تثبيت القصيدة'}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs hover:bg-neutral-50 cursor-pointer"
                    >
                      {poem.pinned === 1 ? <PinOff size={13} /> : <Pin size={13} />}
                      <span>{poem.pinned === 1 ? 'إلغاء التثبيت' : 'تثبيت'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPng(poem)}
                      title="تنزيل كبطاقة PNG"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs hover:bg-neutral-50 cursor-pointer"
                    >
                      <Download size={13} />
                      <span>بطاقة PNG</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(poem)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs hover:bg-neutral-50 cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>تعديل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePoem(poem)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs hover:bg-red-100 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      ) : (
        poetryCfg && (
          <div className="space-y-5">
            {/* 1. Page Header, Background & Pattern */}
            <AdminCard title="ترويسة الصفحة والخلفية والزخرفة">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان الصفحة</label>
                  <input
                    type="text"
                    value={poetryCfg.pageTitle}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, pageTitle: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الوصف المختصر</label>
                  <input
                    type="text"
                    value={poetryCfg.pageSubtitle}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, pageSubtitle: e.target.value })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">محاذاة الترويسة</label>
                  <select
                    value={poetryCfg.headerAlign}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, headerAlign: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="right">يمين</option>
                    <option value="center">توسيط</option>
                    <option value="left">يسار</option>
                  </select>
                </div>

                <ColorField
                  label="خلفية الترويسة"
                  value={poetryCfg.headerBgColor}
                  onChange={(v) => setPoetryCfg({ ...poetryCfg, headerBgColor: v })}
                />
                <ColorField
                  label="خلفية الصفحة"
                  value={poetryCfg.pageBgColor}
                  onChange={(v) => setPoetryCfg({ ...poetryCfg, pageBgColor: v })}
                />
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">النمط الزخرفي في الترويسة</label>
                  <select
                    value={poetryCfg.pattern}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, pattern: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="none">بدون زخرفة</option>
                    <option value="islamic-star">نجمة إسلامية</option>
                    <option value="diamond-strip">معينات متصلة</option>
                    <option value="geometric-grid">شبكة هندسية</option>
                    <option value="interlocking-octagons">مثمنات متداخلة</option>
                    <option value="arabesque-mesh">نسيج أرابيسك</option>
                  </select>
                </div>

                <ColorField
                  label="لون الزخرفة الأساسي"
                  value={poetryCfg.patternPrimary}
                  onChange={(v) => setPoetryCfg({ ...poetryCfg, patternPrimary: v })}
                />
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">شفافية الزخرفة (0..1)</label>
                  <input
                    type="number"
                    step="0.02"
                    min={0}
                    max={1}
                    value={poetryCfg.patternOpacity}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, patternOpacity: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={poetryCfg.showBreadcrumb}
                      onChange={(e) => setPoetryCfg({ ...poetryCfg, showBreadcrumb: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>إظهار مسار التنقل (Breadcrumb)</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">رابط صورة خلفية الترويسة</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={poetryCfg.headerBgImage}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, headerBgImage: e.target.value })}
                    placeholder="https://... أو /uploads/..."
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">رابط صورة خلفية الصفحة</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={poetryCfg.pageBgImage}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, pageBgImage: e.target.value })}
                    placeholder="https://... أو /uploads/..."
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            </AdminCard>

            {/* 2. Poem Cards Design, Typography & Layout */}
            <AdminCard title="تصميم بطاقات القصائد والخطوط والترقيم">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <ColorField
                  label="خلفية بطاقة القصيدة"
                  value={poetryCfg.cardBg}
                  onChange={(v) => setPoetryCfg({ ...poetryCfg, cardBg: v })}
                />
                <ColorField
                  label="لون حدود البطاقة"
                  value={poetryCfg.cardBorderColor}
                  onChange={(v) => setPoetryCfg({ ...poetryCfg, cardBorderColor: v })}
                />
                <ColorField
                  label="لون الفواصل والزخارف"
                  value={poetryCfg.separatorColor}
                  onChange={(v) => setPoetryCfg({ ...poetryCfg, separatorColor: v })}
                />
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">نمط الفاصل الشعري</label>
                  <select
                    value={poetryCfg.separatorStyle}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, separatorStyle: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="diamond">معين ذهبي</option>
                    <option value="ornament">زخرفة نباتية</option>
                    <option value="star">نجمة</option>
                    <option value="dots">نقاط</option>
                    <option value="line">خط بسيط</option>
                    <option value="none">بدون فاصل</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">سماكة الحدود (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={poetryCfg.cardBorderWidth}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, cardBorderWidth: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">تدوير الزوايا (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={poetryCfg.cardBorderRadius}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, cardBorderRadius: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الحشوة الداخلية (px)</label>
                  <input
                    type="number"
                    min={12}
                    max={60}
                    value={poetryCfg.cardPadding}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, cardPadding: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">تأثير التمرير على البطاقة</label>
                  <select
                    value={poetryCfg.hoverEffect}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, hoverEffect: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="lift">ارتفاع للأعلى</option>
                    <option value="glow">توهج ذهبي</option>
                    <option value="border">إبراز الإطار</option>
                    <option value="none">بدون</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">أعمدة سطح المكتب</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={poetryCfg.columnsDesktop}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, columnsDesktop: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">عدد القصائد بالصفحة</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={poetryCfg.poemsPerPage}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, poemsPerPage: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">نمط الترقيم</label>
                  <select
                    value={poetryCfg.paginationMode}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, paginationMode: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="pages">أرقام صفحات</option>
                    <option value="load-more">زر عرض المزيد</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الترتيب الافتراضي</label>
                  <select
                    value={poetryCfg.defaultSort}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, defaultSort: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                  >
                    <option value="pinned-newest">المثبتة ثم الأحدث</option>
                    <option value="newest">الأحدث</option>
                    <option value="oldest">الأقدم</option>
                    <option value="manual-order">الترتيب اليدوي</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-5 pt-2 border-t border-neutral-100">
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={poetryCfg.showSearchFilter}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, showSearchFilter: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>إظهار شريط البحث داخل الديوان</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={poetryCfg.showPoetFilter}
                    onChange={(e) => setPoetryCfg({ ...poetryCfg, showPoetFilter: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>إظهار فلتر اختيار الشاعر</span>
                </label>
              </div>
            </AdminCard>

            {/* 3. Full "شارك" Button Controls */}
            <AdminCard title="إعدادات زر المشاركة («شارك») الظاهر للزوار">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6">
                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={poetryCfg.submissionsEnabled}
                      onChange={(e) => setPoetryCfg({ ...poetryCfg, submissionsEnabled: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل استقبال مشاركات الزوار (تصل للإدارة فقط دون تسجيل دخول)</span>
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={poetryCfg.shareButton.visible}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, visible: e.target.checked },
                        })
                      }
                      className="accent-[#B08D45]"
                    />
                    <span>إظهار زر «{poetryCfg.shareButton.label || 'شارك'}» في صفحة القصائد</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">اسم الزر (النص)</label>
                    <input
                      type="text"
                      value={poetryCfg.shareButton.label}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, label: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">الأيقونة</label>
                    <select
                      value={poetryCfg.shareButton.icon}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, icon: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                    >
                      <option value="Feather">ريشة (Feather)</option>
                      <option value="PenLine">قلم (PenLine)</option>
                      <option value="Send">إرسال (Send)</option>
                      <option value="Sparkles">نجوم (Sparkles)</option>
                      <option value="Plus">زائد (Plus)</option>
                      <option value="none">بدون أيقونة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم الزر</label>
                    <select
                      value={poetryCfg.shareButton.size}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, size: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                    >
                      <option value="sm">صغير (Small)</option>
                      <option value="md">متوسط (Medium)</option>
                      <option value="lg">كبير (Large)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">موضع الزر</label>
                    <select
                      value={poetryCfg.shareButton.position}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, position: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                    >
                      <option value="top-left">يسار الترويسة</option>
                      <option value="top-center">توسيط الترويسة</option>
                      <option value="top-right">يمين الترويسة</option>
                    </select>
                  </div>

                  <ColorField
                    label="لون خلفية الزر"
                    value={poetryCfg.shareButton.bgColor}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        shareButton: { ...poetryCfg.shareButton, bgColor: v },
                      })
                    }
                  />
                  <ColorField
                    label="لون نص الزر"
                    value={poetryCfg.shareButton.color}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        shareButton: { ...poetryCfg.shareButton, color: v },
                      })
                    }
                  />
                  <ColorField
                    label="خلفية الزر عند التمرير"
                    value={poetryCfg.shareButton.hoverBgColor}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        shareButton: { ...poetryCfg.shareButton, hoverBgColor: v },
                      })
                    }
                  />
                  <ColorField
                    label="لون النص عند التمرير"
                    value={poetryCfg.shareButton.hoverColor}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        shareButton: { ...poetryCfg.shareButton, hoverColor: v },
                      })
                    }
                  />
                  <ColorField
                    label="لون حدود الزر"
                    value={poetryCfg.shareButton.borderColor}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        shareButton: { ...poetryCfg.shareButton, borderColor: v },
                      })
                    }
                  />
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">سماكة حدود الزر (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={poetryCfg.shareButton.borderWidth}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, borderWidth: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">تدوير حواف الزر (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={poetryCfg.shareButton.borderRadius}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, borderRadius: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">تأثير التمرير</label>
                    <select
                      value={poetryCfg.shareButton.hoverEffect}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, hoverEffect: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                    >
                      <option value="lift">ارتفاع للأعلى</option>
                      <option value="glow">توهج</option>
                      <option value="scale">تكبير لطيف</option>
                      <option value="none">بدون</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">تأثير النقر</label>
                    <select
                      value={poetryCfg.shareButton.clickEffect}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, clickEffect: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                    >
                      <option value="press">انضغاط</option>
                      <option value="none">بدون</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">ظل الزر (CSS Shadow)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={poetryCfg.shareButton.shadow}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          shareButton: { ...poetryCfg.shareButton, shadow: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </AdminCard>

            {/* 4. Submission Form Builder & Messages */}
            <AdminCard title="تخصيص نموذج اقتراح القصيدة والرسائل والحقول">
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان النموذج</label>
                    <input
                      type="text"
                      value={poetryCfg.submissionForm.title}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, title: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">النص التوضيحي</label>
                    <input
                      type="text"
                      value={poetryCfg.submissionForm.subtitle}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, subtitle: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">نص زر الإرسال</label>
                    <input
                      type="text"
                      value={poetryCfg.submissionForm.submitLabel}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, submitLabel: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">رسالة النجاح بعد الإرسال</label>
                    <input
                      type="text"
                      value={poetryCfg.submissionForm.successMessage}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, successMessage: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">رسالة الخطأ</label>
                    <input
                      type="text"
                      value={poetryCfg.submissionForm.errorMessage}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, errorMessage: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">ملاحظة الخصوصية أسفل النموذج</label>
                    <input
                      type="text"
                      value={poetryCfg.submissionForm.privacyNotice}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, privacyNotice: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">أقصى عدد أحرف للأبيات</label>
                    <input
                      type="number"
                      min={200}
                      max={30000}
                      value={poetryCfg.submissionForm.maxCharacters}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, maxCharacters: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">عدد أسطر مربع الأبيات</label>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={poetryCfg.submissionForm.textareaRows}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, textareaRows: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">عرض نافذة النموذج</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={poetryCfg.submissionForm.width}
                      onChange={(e) =>
                        setPoetryCfg({
                          ...poetryCfg,
                          submissionForm: { ...poetryCfg.submissionForm, width: e.target.value },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
                    />
                  </div>

                  <ColorField
                    label="خلفية نافذة النموذج"
                    value={poetryCfg.submissionForm.bgColor}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        submissionForm: { ...poetryCfg.submissionForm, bgColor: v },
                      })
                    }
                  />
                  <ColorField
                    label="لون زر الإرسال"
                    value={poetryCfg.submissionForm.submitBg}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        submissionForm: { ...poetryCfg.submissionForm, submitBg: v },
                      })
                    }
                  />
                  <ColorField
                    label="لون نص زر الإرسال"
                    value={poetryCfg.submissionForm.submitText}
                    onChange={(v) =>
                      setPoetryCfg({
                        ...poetryCfg,
                        submissionForm: { ...poetryCfg.submissionForm, submitText: v },
                      })
                    }
                  />
                </div>

                {/* Built-in fields customization */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
                  <div className="text-xs font-extrabold text-neutral-800">الحقول الأساسية في النموذج (إظهار / إخفاء / إلزامي أو اختياري)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">تسمية حقل العنوان</label>
                      <input
                        type="text"
                        value={poetryCfg.submissionForm.labelTitle}
                        onChange={(e) =>
                          setPoetryCfg({
                            ...poetryCfg,
                            submissionForm: { ...poetryCfg.submissionForm, labelTitle: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">تسمية حقل الأبيات</label>
                      <input
                        type="text"
                        value={poetryCfg.submissionForm.labelVerses}
                        onChange={(e) =>
                          setPoetryCfg({
                            ...poetryCfg,
                            submissionForm: { ...poetryCfg.submissionForm, labelVerses: e.target.value },
                          })
                        }
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={poetryCfg.submissionForm.showPoetName !== false}
                            onChange={(e) =>
                              setPoetryCfg({
                                ...poetryCfg,
                                submissionForm: { ...poetryCfg.submissionForm, showPoetName: e.target.checked },
                              })
                            }
                            className="accent-[#B08D45]"
                          />
                          <span>إظهار حقل اسم الشاعر</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={poetryCfg.submissionForm.requirePoetName}
                            onChange={(e) =>
                              setPoetryCfg({
                                ...poetryCfg,
                                submissionForm: { ...poetryCfg.submissionForm, requirePoetName: e.target.checked },
                              })
                            }
                            className="accent-[#B08D45]"
                          />
                          <span>إلزامي</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={poetryCfg.submissionForm.labelPoetName}
                        onChange={(e) =>
                          setPoetryCfg({
                            ...poetryCfg,
                            submissionForm: { ...poetryCfg.submissionForm, labelPoetName: e.target.value },
                          })
                        }
                        placeholder="اسم الحقل"
                        className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={poetryCfg.submissionForm.placeholderPoetName}
                        onChange={(e) =>
                          setPoetryCfg({
                            ...poetryCfg,
                            submissionForm: { ...poetryCfg.submissionForm, placeholderPoetName: e.target.value },
                          })
                        }
                        placeholder="النص التلميحي داخل الحقل"
                        className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
                      />
                    </div>

                    <div className="rounded-lg border border-neutral-200 bg-white p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={poetryCfg.submissionForm.showExtraInfo}
                            onChange={(e) =>
                              setPoetryCfg({
                                ...poetryCfg,
                                submissionForm: { ...poetryCfg.submissionForm, showExtraInfo: e.target.checked },
                              })
                            }
                            className="accent-[#B08D45]"
                          />
                          <span>إظهار حقل المعلومات الإضافية</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={poetryCfg.submissionForm.requireExtraInfo}
                            onChange={(e) =>
                              setPoetryCfg({
                                ...poetryCfg,
                                submissionForm: { ...poetryCfg.submissionForm, requireExtraInfo: e.target.checked },
                              })
                            }
                            className="accent-[#B08D45]"
                          />
                          <span>إلزامي</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={poetryCfg.submissionForm.labelExtraInfo}
                        onChange={(e) =>
                          setPoetryCfg({
                            ...poetryCfg,
                            submissionForm: { ...poetryCfg.submissionForm, labelExtraInfo: e.target.value },
                          })
                        }
                        placeholder="اسم الحقل"
                        className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={poetryCfg.submissionForm.placeholderExtraInfo}
                        onChange={(e) =>
                          setPoetryCfg({
                            ...poetryCfg,
                            submissionForm: { ...poetryCfg.submissionForm, placeholderExtraInfo: e.target.value },
                          })
                        }
                        placeholder="النص التلميحي داخل الحقل"
                        className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Form Fields Builder */}
                <div className="rounded-xl border border-[#DECBA0] bg-[#FAF7F0]/60 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-extrabold text-neutral-900">حقول إضافية مخصصة داخل نموذج «شارك»</div>
                      <div className="text-[11px] text-neutral-500">أضف أو احذف أي حقل (مثل: رقم التواصل، البريد، مناسبة القصيدة...) وحدد إن كان إلزامياً أو اختيارياً</div>
                    </div>
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>إضافة حقل للنموذج</span>
                    </button>
                  </div>

                  {(poetryCfg.submissionForm.customFields || []).length === 0 ? (
                    <p className="text-xs text-neutral-500 py-2">لا توجد حقول إضافية مخصصة بعد.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {(poetryCfg.submissionForm.customFields || []).map((cf) => (
                        <div
                          key={cf.id}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-neutral-200"
                        >
                          <input
                            type="text"
                            value={cf.label}
                            onChange={(e) => updateCustomField(cf.id, { label: e.target.value })}
                            placeholder="اسم الحقل"
                            className="sm:col-span-3 rounded border border-neutral-200 px-2.5 py-1.5 text-xs"
                          />
                          <input
                            type="text"
                            value={cf.placeholder}
                            onChange={(e) => updateCustomField(cf.id, { placeholder: e.target.value })}
                            placeholder="النص التلميحي"
                            className="sm:col-span-4 rounded border border-neutral-200 px-2.5 py-1.5 text-xs"
                          />
                          <select
                            value={cf.type}
                            onChange={(e) => updateCustomField(cf.id, { type: e.target.value as any })}
                            className="sm:col-span-2 rounded border border-neutral-200 px-2 py-1.5 text-xs bg-white"
                          >
                            <option value="text">نص قصير</option>
                            <option value="textarea">نص طويل</option>
                            <option value="email">بريد إلكتروني</option>
                            <option value="phone">رقم هاتف</option>
                          </select>
                          <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer justify-center">
                            <input
                              type="checkbox"
                              checked={cf.required}
                              onChange={(e) => updateCustomField(cf.id, { required: e.target.checked })}
                              className="accent-[#B08D45]"
                            />
                            <span>إلزامي</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeCustomField(cf.id)}
                            title="حذف الحقل"
                            className="sm:col-span-1 p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </AdminCard>

            {/* 5. Custom CSS */}
            <AdminCard title="CSS مخصص لصفحة القصائد (اختياري)">
              <textarea
                rows={4}
                dir="ltr"
                value={poetryCfg.customCss}
                onChange={(e) => setPoetryCfg({ ...poetryCfg, customCss: e.target.value })}
                placeholder="/* CSS خاص بصفحة قصائد */"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
              />
            </AdminCard>
          </div>
        )
      )}

      {/* Modal Add/Edit Poem */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSavePoem}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-extrabold text-neutral-900">
                {editingId ? 'تعديل القصيدة' : 'إضافة قصيدة جديدة'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-neutral-500 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان القصيدة *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">اسم الشاعر / القائل</label>
                <input
                  type="text"
                  value={form.poet_name}
                  onChange={(e) => setForm({ ...form, poet_name: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الرابط المختصر (Slug)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="تلقائي عند الترك فارغاً"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الحالة</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                >
                  <option value="published">منشورة فوراً</option>
                  <option value="draft">مسودة</option>
                  <option value="scheduled">مجدولة</option>
                  <option value="hidden">مخفية</option>
                </select>
              </div>
            </div>

            {form.status === 'scheduled' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">تاريخ النشر المجدول</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">مقدمة أو مناسبة القصيدة</label>
              <input
                type="text"
                value={form.intro_text}
                onChange={(e) => setForm({ ...form, intro_text: e.target.value })}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">أبيات القصيدة *</label>
              <textarea
                rows={7}
                required
                value={form.verses_text}
                onChange={(e) => setForm({ ...form, verses_text: e.target.value })}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm leading-loose"
              />
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 space-y-3">
              <div className="text-xs font-bold text-neutral-800">تخصيص تصميم هذه القصيدة منفردة (اختياري)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ColorField
                  label="خلفية البطاقة"
                  value={form.design.cardBg || ''}
                  onChange={(v) => setForm({ ...form, design: { ...form.design, cardBg: v } })}
                />
                <ColorField
                  label="لون العنوان"
                  value={form.design.titleColor || ''}
                  onChange={(v) => setForm({ ...form, design: { ...form.design, titleColor: v } })}
                />
                <ColorField
                  label="لون الأبيات"
                  value={form.design.verseColor || ''}
                  onChange={(v) => setForm({ ...form, design: { ...form.design, verseColor: v } })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>تثبيت القصيدة في أعلى الصفحة</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingPoem}
                  className="px-5 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] disabled:opacity-60 cursor-pointer"
                >
                  {savingPoem ? 'جاري الحفظ...' : 'حفظ القصيدة'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
