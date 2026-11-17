import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Code2, Eye, Layers, Plus, Power, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import type { CustomComponentConfig } from '../../../types/platform';

interface CodeSnippet {
  id: number;
  name: string;
  scope: 'global' | 'page' | 'home' | 'component';
  target_page_id: number | null;
  target_selector?: string;
  code_type: 'css' | 'html' | 'js' | 'svg';
  code: string;
  last_working_code: string;
  enabled: number;
  status: 'published' | 'draft';
  last_error: string;
  updated_at: string;
}

const COMPONENT_PRESETS = [
  { value: 'cards', label: 'البطاقات (.media-card)' },
  { value: 'navigation', label: 'شريط التنقل (header nav)' },
  { value: 'buttons', label: 'الأزرار (.btn-action)' },
  { value: 'player', label: 'مشغل الفيديو (.video-player)' },
  { value: 'loaders', label: 'مؤشرات التحميل (.custom-loader)' },
  { value: 'icons', label: 'الأيقونات (svg)' },
];

const SCOPE_LABELS: Record<CodeSnippet['scope'], string> = {
  global: 'عام',
  page: 'صفحة محددة',
  home: 'الرئيسية',
  component: 'مكون محدد',
};

export function AdminCustomCode() {
  const { pages, settings, saveCategory, resetCategory, notify } = useAdmin();
  const [activeTab, setActiveTab] = useState<'snippets' | 'components'>('snippets');
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [selected, setSelected] = useState<Partial<CodeSnippet>>({
    name: '',
    scope: 'global',
    target_page_id: null,
    target_selector: '',
    code_type: 'css',
    code: '',
    enabled: 1,
    status: 'published',
  });
  const [components, setComponents] = useState<CustomComponentConfig[]>([]);
  const [selectedCompIdx, setSelectedCompIdx] = useState<number>(0);
  const [savingComponents, setSavingComponents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [validationOk, setValidationOk] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(true);

  useEffect(() => {
    if (settings?.customComponents) {
      setComponents(structuredClone(settings.customComponents));
    }
  }, [settings?.customComponents]);

  const activeComp = components[selectedCompIdx] || null;
  const updateComp = (idx: number, patch: Partial<CustomComponentConfig>) => {
    setComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const loadSnippets = async () => {
    const res = await fetch('/api/admin/custom-code', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setSnippets(data.snippets || []);
    }
  };

  useEffect(() => {
    loadSnippets();
  }, []);

  const scopedPreviewCss = useMemo(() => {
    if (selected.code_type !== 'css' || !selected.code) return '';
    return selected.code;
  }, [selected.code_type, selected.code]);

  const handleValidateCode = async () => {
    setValidationError('');
    setValidationOk('');
    setValidating(true);
    try {
      const res = await fetch('/api/admin/custom-code/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code_type: selected.code_type || 'css',
          code: selected.code || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid !== false) {
        setValidationOk('الكود سليم برمجياً ومتوافق مع قواعد الأمان.');
        notify('تم فحص الكود: سليم وجاهز للنشر');
      } else {
        const msg = data.error || 'يوجد خطأ في صياغة الكود أو قواعد الأمان.';
        setValidationError(msg);
        notify(msg, 'error');
      }
    } finally {
      setValidating(false);
    }
  };

  const handleInstantDisable = async () => {
    if (!selected.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/custom-code/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...selected, enabled: 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadSnippets();
        setSelected(data.snippet || { ...selected, enabled: 0 });
        notify('تم تعطيل المقطع فوراً عن الموقع العام');
      } else {
        notify(data.error || 'تعذر تعطيل المقطع', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSnippet = async () => {
    setValidationError('');
    setValidationOk('');
    if (!selected.name?.trim()) {
      notify('يرجى إدخال اسم المقطع البرمجي', 'error');
      setValidationError('يرجى إدخال اسم المقطع البرمجي قبل الحفظ.');
      return;
    }
    setSaving(true);
    try {
      const isEdit = Boolean(selected.id);
      const url = isEdit ? `/api/admin/custom-code/${selected.id}` : '/api/admin/custom-code';
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(selected),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data.error || 'فشل حفظ الكود المخصص لوجود خطأ في الصياغة البرمجية.';
        setValidationError(errMsg);
        notify(errMsg, 'error');
        await loadSnippets();
        return;
      }
      setValidationError('');
      setValidationOk('تم الحفظ والنشر والتحقق من الصياغة بنجاح.');
      notify('تم حفظ المقطع البرمجي بنجاح');
      await loadSnippets();
      setSelected(data.snippet);
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (id: number) => {
    const res = await fetch(`/api/admin/custom-code/${id}/rollback`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر الاسترجاع', 'error');
      return;
    }
    setValidationError('');
    notify('تمت استعادة آخر نسخة عاملة بنجاح');
    await loadSnippets();
    setSelected(data.snippet);
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/custom-code/${id}`, { method: 'DELETE', credentials: 'include' });
    notify('تم حذف المقطع البرمجي');
    await loadSnippets();
    if (selected.id === id) {
      setValidationError('');
      setSelected({
        name: '',
        scope: 'global',
        target_page_id: null,
        target_selector: '',
        code_type: 'css',
        code: '',
        enabled: 1,
        status: 'published',
      });
    }
  };

  const activeErrorMessage = validationError || selected.last_error || '';

  return (
    <div>
      <AdminPanelHeader
        title="إدارة الأكواد والمكونات المخصصة المتقدمة"
        subtitle="إضافة أنماط CSS أو HTML/SVG أو JS مخصصة على مستوى الموقع، أو بناء مكونات قابلة لإعادة الاستخدام في مواضع المنصة"
        onSave={
          activeTab === 'components'
            ? async () => {
                setSavingComponents(true);
                await saveCategory('customComponents', components, 'تحديث المكونات المخصصة');
                setSavingComponents(false);
              }
            : undefined
        }
        onReset={activeTab === 'components' ? () => resetCategory('customComponents') : undefined}
        saving={savingComponents}
        actions={
          activeTab === 'snippets' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 cursor-pointer"
              >
                <Eye size={14} />
                <span>{showPreview ? 'إخفاء المعاينة' : 'إظهار المعاينة'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setValidationError('');
                  setValidationOk('');
                  setSelected({
                    name: 'كود مخصص جديد',
                    scope: 'global',
                    target_page_id: null,
                    target_selector: '',
                    code_type: 'css',
                    code: '/* أضف قواعد CSS المخصصة هنا */\n',
                    enabled: 1,
                    status: 'published',
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>مقطع جديد</span>
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setActiveTab('snippets')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            activeTab === 'snippets'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          <Code2 size={14} /> الأكواد البرمجية المتقدمة ({snippets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('components')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            activeTab === 'components'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          <Layers size={14} /> بناء مكونات مخصصة ({components.length})
        </button>
      </div>

      {activeTab === 'snippets' ? (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AdminCard title="المقاطع البرمجية المحفوظة">
          {snippets.length === 0 ? (
            <p className="text-xs text-neutral-500 py-6 text-center">لا توجد أكواد مخصصة مضافة بعد.</p>
          ) : (
            <div className="space-y-2">
              {snippets.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setValidationError('');
                    setValidationOk('');
                    setSelected(s);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 ${
                    selected.id === s.id
                      ? 'border-[#B08D45] bg-[#F7F4EC]'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-neutral-900 truncate">{s.name}</span>
                      {s.last_error && (
                        <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {s.code_type.toUpperCase()} · {SCOPE_LABELS[s.scope] || s.scope} ·{' '}
                      {s.enabled && s.status === 'published' ? 'مفعّل' : 'مسودة/معطل'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    className="text-red-600 p-1 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <div className="lg:col-span-2 space-y-5">
          <AdminCard title={selected.id ? `تحرير: ${selected.name}` : 'إنشاء مقطع برمجي جديد'}>
            <div className="space-y-4">
              {activeErrorMessage && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2 text-xs text-red-800">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <div className="font-bold">تنبيه التحقق من الصياغة أو الأمان:</div>
                      <div className="mt-0.5">{activeErrorMessage}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.id && Boolean(selected.enabled) && (
                      <button
                        type="button"
                        onClick={handleInstantDisable}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 text-xs font-bold hover:bg-red-100 cursor-pointer"
                      >
                        <Power size={13} />
                        <span>تعطيل المقطع فوراً</span>
                      </button>
                    )}
                    {selected.id && selected.last_working_code && (
                      <button
                        type="button"
                        onClick={() => handleRollback(selected.id!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
                      >
                        <RotateCcw size={13} />
                        <span>استرجاع آخر نسخة عاملة</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {validationOk && !activeErrorMessage && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 flex items-center gap-2 text-xs text-emerald-800">
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  <span className="font-semibold">{validationOk}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">اسم المقطع</label>
                  <input
                    type="text"
                    value={selected.name || ''}
                    onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">النوع</label>
                  <select
                    value={selected.code_type || 'css'}
                    onChange={(e) => setSelected({ ...selected, code_type: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="css">CSS</option>
                    <option value="html">HTML / SVG</option>
                    <option value="svg">SVG</option>
                    <option value="js">JavaScript</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">النطاق</label>
                  <select
                    value={selected.scope || 'global'}
                    onChange={(e) => setSelected({ ...selected, scope: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="global">كامل الموقع العام</option>
                    <option value="home">الصفحة الرئيسية فقط</option>
                    <option value="page">صفحة محددة</option>
                    <option value="component">عنصر / مكون محدد</option>
                  </select>
                </div>
              </div>

              {selected.scope === 'page' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الصفحة المستهدفة</label>
                  <select
                    value={selected.target_page_id || ''}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        target_page_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="">اختر صفحة...</option>
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selected.scope === 'component' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">اختيار مكون سريع</label>
                    <select
                      value={
                        COMPONENT_PRESETS.some((p) => p.value === selected.target_selector)
                          ? selected.target_selector
                          : ''
                      }
                      onChange={(e) => setSelected({ ...selected, target_selector: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="">-- محدد مخصص أدناه --</option>
                      {COMPONENT_PRESETS.map((cp) => (
                        <option key={cp.value} value={cp.value}>
                          {cp.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">محدد CSS أو اسم المكون</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={selected.target_selector || ''}
                      onChange={(e) => setSelected({ ...selected, target_selector: e.target.value })}
                      placeholder="cards / player / .my-selector"
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Code2 size={14} />
                    <span>الكود البرمجي</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selected.enabled)}
                        onChange={(e) => setSelected({ ...selected, enabled: e.target.checked ? 1 : 0 })}
                        className="accent-[#B08D45]"
                      />
                      <span>مفعّل</span>
                    </label>
                    <select
                      value={selected.status || 'published'}
                      onChange={(e) => setSelected({ ...selected, status: e.target.value as any })}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="published">منشور</option>
                      <option value="draft">مسودة</option>
                    </select>
                  </div>
                </div>
                <textarea
                  dir="ltr"
                  rows={10}
                  value={selected.code || ''}
                  onChange={(e) => setSelected({ ...selected, code: e.target.value })}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-950 text-[#D4AF65] p-3 text-xs font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSnippet}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
                >
                  <Save size={14} />
                  <span>{saving ? 'جاري الحفظ...' : 'حفظ ونشر المقطع'}</span>
                </button>
                <button
                  type="button"
                  disabled={validating}
                  onClick={handleValidateCode}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
                >
                  <ShieldCheck size={14} className="text-[#8C6A2F]" />
                  <span>{validating ? 'جاري الفحص...' : 'فحص الصياغة والأمان'}</span>
                </button>
                {selected.id && Boolean(selected.enabled) && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleInstantDisable}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    <Power size={14} />
                    <span>تعطيل المقطع فوراً</span>
                  </button>
                )}
                {selected.id && selected.last_working_code && (
                  <button
                    type="button"
                    onClick={() => handleRollback(selected.id!)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    <span>الرجوع لآخر نسخة عاملة</span>
                  </button>
                )}
              </div>
            </div>
          </AdminCard>

          {showPreview && (
            <AdminCard title="معاينة معزولة للمقطع البرمجي">
              {selected.code_type === 'css' && (
                <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50">
                  <style>{`#custom-code-sandbox { ${scopedPreviewCss} }`}</style>
                  <div id="custom-code-sandbox" className="space-y-2 rounded-xl bg-white p-4 border border-neutral-200">
                    <div className="text-xs font-bold text-[#8C6A2F]">شارة القسم التجريبية</div>
                    <h4 className="text-base font-bold text-neutral-900">عنوان عنصر تجريبي في الواجهة العامة</h4>
                    <p className="text-xs text-neutral-600">
                      نص وصفي يوضح تأثير قواعد CSS المخصصة قبل النشر على الموقع العام.
                    </p>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold"
                    >
                      زر تفاعلي
                    </button>
                  </div>
                </div>
              )}

              {(selected.code_type === 'html' || selected.code_type === 'svg') && (
                <div className="border border-neutral-200 rounded-xl p-2 bg-neutral-50">
                  <iframe
                    title="custom-code-preview"
                    sandbox=""
                    srcDoc={
                      selected.code ||
                      '<p style="font-size:12px;color:#888;font-family:sans-serif;direction:rtl">أدخل كود HTML أو SVG للمعاينة المعزولة</p>'
                    }
                    className="w-full min-h-[140px] border-0 rounded-lg bg-white"
                  />
                </div>
              )}

              {selected.code_type === 'js' && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                  يتم فحص صياغة كود JavaScript تلقائياً عند الحفظ عبر المحرك الخلفي، ويعمل في الصفحات العامة عند التفعيل والنشر فقط لضمان عدم تأثر لوحة التحكم بأي خطأ برمجي.
                </div>
              )}
            </AdminCard>
          )}
        </div>
      </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <AdminCard title="قائمة المكونات المخصصة">
            <button
              type="button"
              onClick={() => {
                const next: CustomComponentConfig = {
                  id: `comp-${Date.now()}`,
                  name: 'مكون مخصص جديد',
                  location: 'home-after-sections',
                  html: '<div class="p-4 rounded-xl border border-[#B08D45]/30 bg-[#F7F4EC] text-sm font-bold text-[#171717]">محتوى مكون مخصص</div>',
                  css: '',
                  js: '',
                  visible: true,
                  targetPageId: null,
                };
                setComponents((prev) => [...prev, next]);
                setSelectedCompIdx(components.length);
              }}
              className="w-full mb-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <Plus size={14} /> إنشاء مكون جديد
            </button>

            {components.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">لا توجد مكونات مخصصة بعد.</p>
            ) : (
              <div className="space-y-2">
                {components.map((comp, idx) => (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedCompIdx(idx)}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                      idx === selectedCompIdx
                        ? 'border-[#B08D45] bg-[#F7F4EC]'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-900 truncate">{comp.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {comp.location} · {comp.visible ? 'ظاهر' : 'مخفي'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = components.filter((_, i) => i !== idx);
                        setComponents(next);
                        setSelectedCompIdx(Math.max(0, Math.min(selectedCompIdx, next.length - 1)));
                      }}
                      className="text-red-600 p-1 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          <div className="lg:col-span-2 space-y-5">
            {activeComp ? (
              <AdminCard title={`تحرير المكون: ${activeComp.name}`}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">اسم المكون</label>
                      <input
                        type="text"
                        value={activeComp.name}
                        onChange={(e) => updateComp(selectedCompIdx, { name: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">موضع العرض بالموقع</label>
                      <select
                        value={activeComp.location}
                        onChange={(e) => updateComp(selectedCompIdx, { location: e.target.value as any })}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="hero-top">أعلى القسم الترحيبي (Hero Top)</option>
                        <option value="hero-bottom">أسفل القسم الترحيبي (Hero Bottom)</option>
                        <option value="home-after-sections">بعد أقسام الرئيسية</option>
                        <option value="collection-top">أعلى صفحات الأقسام</option>
                        <option value="detail-top">أعلى صفحات التفاصيل</option>
                        <option value="footer-top">أعلى التذييل (Footer Top)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">تقييد بصفحة محددة (اختياري)</label>
                      <select
                        value={activeComp.targetPageId || ''}
                        onChange={(e) =>
                          updateComp(selectedCompIdx, {
                            targetPageId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="">كافة الصفحات المطابقة للموضع</option>
                        {pages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeComp.visible}
                      onChange={(e) => updateComp(selectedCompIdx, { visible: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل ظهور المكون في الموقع العام</span>
                  </label>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">بنية HTML / SVG</label>
                    <textarea
                      dir="ltr"
                      rows={5}
                      value={activeComp.html}
                      onChange={(e) => updateComp(selectedCompIdx, { html: e.target.value })}
                      className="w-full rounded-xl border border-neutral-300 bg-neutral-950 text-[#D4AF65] p-3 text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">أنماط CSS خاصة بالمكون</label>
                      <textarea
                        dir="ltr"
                        rows={4}
                        value={activeComp.css}
                        onChange={(e) => updateComp(selectedCompIdx, { css: e.target.value })}
                        className="w-full rounded-xl border border-neutral-300 bg-neutral-950 text-emerald-300 p-3 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">تفاعل JavaScript (اختياري)</label>
                      <textarea
                        dir="ltr"
                        rows={4}
                        value={activeComp.js}
                        onChange={(e) => updateComp(selectedCompIdx, { js: e.target.value })}
                        className="w-full rounded-xl border border-neutral-300 bg-neutral-950 text-amber-200 p-3 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="border border-neutral-200 rounded-xl p-2 bg-neutral-50">
                    <div className="text-[11px] font-bold text-neutral-600 mb-1.5 px-1">معاينة معزولة للمكون</div>
                    <iframe
                      title="custom-component-preview"
                      sandbox=""
                      srcDoc={`<!doctype html><html dir="rtl" lang="ar"><head><style>body{margin:8px;font-family:sans-serif}${activeComp.css || ''}</style></head><body>${activeComp.html || ''}</body></html>`}
                      className="w-full min-h-[120px] border-0 rounded-lg bg-white"
                    />
                  </div>
                </div>
              </AdminCard>
            ) : (
              <AdminCard>
                <p className="text-xs text-neutral-500 text-center py-10">
                  اختر مكوناً من القائمة أو أنشئ مكوناً مخصصاً جديداً.
                </p>
              </AdminCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
