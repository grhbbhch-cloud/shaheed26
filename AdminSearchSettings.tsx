import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { CONTENT_TYPE_LABELS } from '../../../lib/styleEngine';
import type { AllSettings } from '../../../types/platform';

export function AdminSearchSettings() {
  const { settings, previousSettings, pages, saveCategory, resetCategory, notify } = useAdmin();
  const [searchCfg, setSearchCfg] = useState<AllSettings['search'] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      const cloned = structuredClone(settings.search);
      if ((cloned.defaultSort as string) === 'views') {
        cloned.defaultSort = 'newest';
      }
      setSearchCfg(cloned);
    }
  }, [settings]);

  if (!settings || !searchCfg) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('search', searchCfg, 'تحديث إعدادات البحث');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const cloned = structuredClone(settings.search);
    if ((cloned.defaultSort as string) === 'views') cloned.defaultSort = 'newest';
    setSearchCfg(cloned);
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prev = previousSettings.search as AllSettings['search'] | undefined;
    if (!prev) return;
    const cloned = structuredClone(prev);
    if ((cloned.defaultSort as string) === 'views') cloned.defaultSort = 'newest';
    setSearchCfg(cloned);
    notify('تمت استعادة إعدادات البحث السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges = JSON.stringify(searchCfg) !== JSON.stringify(settings.search);
  const hasPreviousSnapshot = Boolean(previousSettings.search);

  return (
    <div>
      <AdminPanelHeader
        title="إدارة البحث"
        subtitle="تخصيص زر البحث في الشريط العلوي وسلوك صفحة البحث ونطاق المحتوى والصفحات المشمولة"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory('search')}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="space-y-5">
        <AdminCard
          title="معاينة فورية لشريط ونتائج البحث"
          subtitle="تعكس المظهر الفعلي لحقل البحث والتخطيط قبل الحفظ (دون أي عداد مشاهدات)"
        >
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex-1 min-w-[200px] flex items-center gap-2 rounded-lg px-3 py-2 border text-xs"
                style={{
                  backgroundColor: searchCfg.inputBg,
                  color: searchCfg.inputText,
                  borderColor: searchCfg.inputBorder,
                }}
              >
                {searchCfg.showIcon && <Search size={14} className="opacity-70 shrink-0" />}
                <span className="truncate opacity-75">{searchCfg.placeholder}</span>
              </div>
              <button
                type="button"
                className="px-3.5 py-2 rounded-lg text-xs font-bold shrink-0"
                style={{ backgroundColor: searchCfg.buttonBg, color: searchCfg.buttonText }}
              >
                {searchCfg.buttonLabel}
              </button>
            </div>

            {searchCfg.showFilters && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-[#B08D45] text-white text-[11px] font-bold">الكل</span>
                <span className="px-2 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600 text-[11px]">فيديو</span>
                <span className="px-2 py-0.5 rounded bg-white border border-neutral-200 text-neutral-600 text-[11px]">منشور</span>
              </div>
            )}

            {searchCfg.showResultCount !== false && (
              <div className="text-[11px] text-neutral-500">نتائج البحث: 2 عنصر</div>
            )}

            <div className={searchCfg.resultsLayout === 'list' ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'}>
              {['تسجيل وثائقي مصور', 'بيان رسمي ومقال أرشيفي'].map((sampleTitle, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border border-neutral-200 bg-white p-2.5 ${
                    searchCfg.resultsLayout === 'list' ? 'flex items-center justify-between gap-3' : 'space-y-1'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-neutral-900">{sampleTitle}</div>
                    <div className="text-[10px] text-neutral-500">١٦ نوفمبر ٢٠٢٦</div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 font-semibold">
                    {idx === 0 ? 'فيديو' : 'منشور'}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-neutral-500 pt-1 border-t border-neutral-200">
              رسالة عند خلو النتائج: <span className="font-semibold text-neutral-700">{searchCfg.emptyMessage}</span>
            </div>
          </div>
        </AdminCard>
        <AdminCard title="مظهر زر وحقل البحث">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-6">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchCfg.enabled}
                  onChange={(e) => setSearchCfg({ ...searchCfg, enabled: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار زر البحث في الموقع</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchCfg.showIcon}
                  onChange={(e) => setSearchCfg({ ...searchCfg, showIcon: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار أيقونة البحث</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchCfg.showFilters}
                  onChange={(e) => setSearchCfg({ ...searchCfg, showFilters: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار مرشحات التصنيف في صفحة النتائج</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchCfg.searchPageTitles !== false}
                  onChange={(e) => setSearchCfg({ ...searchCfg, searchPageTitles: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>شمل عناوين الصفحات في نتائج البحث</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchCfg.showResultCount !== false}
                  onChange={(e) => setSearchCfg({ ...searchCfg, showResultCount: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار عداد إجمالي النتائج</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نص زر البحث</label>
                <input
                  type="text"
                  value={searchCfg.buttonLabel}
                  onChange={(e) => setSearchCfg({ ...searchCfg, buttonLabel: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نص التلميح (Placeholder)</label>
                <input
                  type="text"
                  value={searchCfg.placeholder}
                  onChange={(e) => setSearchCfg({ ...searchCfg, placeholder: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">رسالة عدم وجود نتائج</label>
                <input
                  type="text"
                  value={searchCfg.emptyMessage}
                  onChange={(e) => setSearchCfg({ ...searchCfg, emptyMessage: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <ColorField label="خلفية الحقل" value={searchCfg.inputBg} onChange={(c) => setSearchCfg({ ...searchCfg, inputBg: c })} />
              <ColorField label="لون نص الحقل" value={searchCfg.inputText} onChange={(c) => setSearchCfg({ ...searchCfg, inputText: c })} />
              <ColorField label="حدود الحقل" value={searchCfg.inputBorder} onChange={(c) => setSearchCfg({ ...searchCfg, inputBorder: c })} />
              <ColorField label="خلفية الزر" value={searchCfg.buttonBg} onChange={(c) => setSearchCfg({ ...searchCfg, buttonBg: c })} />
              <ColorField label="نص الزر" value={searchCfg.buttonText} onChange={(c) => setSearchCfg({ ...searchCfg, buttonText: c })} />
            </div>
          </div>
        </AdminCard>

        <AdminCard title="سلوك ونطاق البحث">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">سلوك البحث</label>
                <select
                  value={searchCfg.behavior}
                  onChange={(e) => setSearchCfg({ ...searchCfg, behavior: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                >
                  <option value="instant">بحث فوري أثناء الكتابة</option>
                  <option value="submit">بحث عند الضغط على الزر</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">تخطيط النتائج</label>
                <select
                  value={searchCfg.resultsLayout}
                  onChange={(e) => setSearchCfg({ ...searchCfg, resultsLayout: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                >
                  <option value="grid">شبكة بطاقات</option>
                  <option value="list">قائمة عمودية</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الترتيب الافتراضي</label>
                <select
                  value={(searchCfg.defaultSort as string) === 'views' ? 'newest' : searchCfg.defaultSort}
                  onChange={(e) => setSearchCfg({ ...searchCfg, defaultSort: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                >
                  <option value="newest">الأحدث</option>
                  <option value="oldest">الأقدم</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">عدد النتائج لكل صفحة</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={searchCfg.resultsPerPage ?? 24}
                  onChange={(e) => setSearchCfg({ ...searchCfg, resultsPerPage: Math.min(60, Math.max(1, Number(e.target.value))) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                أنواع المحتوى المشمولة في البحث (فارغ = الكل)
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CONTENT_TYPE_LABELS).map(([k, lbl]) => {
                  const active = searchCfg.searchableTypes.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() =>
                        setSearchCfg({
                          ...searchCfg,
                          searchableTypes: active
                            ? searchCfg.searchableTypes.filter((t) => t !== k)
                            : [...searchCfg.searchableTypes, k],
                        })
                      }
                      className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                        active
                          ? 'bg-[#B08D45] text-white border-[#B08D45]'
                          : 'bg-white text-neutral-600 border-neutral-300'
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                الصفحات المشمولة في البحث (فارغ = الكل)
              </label>
              <div className="flex flex-wrap gap-2">
                {pages.map((p) => {
                  const active = searchCfg.searchablePageIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setSearchCfg({
                          ...searchCfg,
                          searchablePageIds: active
                            ? searchCfg.searchablePageIds.filter((id) => id !== p.id)
                            : [...searchCfg.searchablePageIds, p.id],
                        })
                      }
                      className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                        active
                          ? 'bg-[#B08D45] text-white border-[#B08D45]'
                          : 'bg-white text-neutral-600 border-neutral-300'
                      }`}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
