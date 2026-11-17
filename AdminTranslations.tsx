import React, { useEffect, useState } from 'react';
import { Globe2, Info, Plus, Subtitles, Trash2 } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import type { SiteI18nConfig, UiTextsConfig } from '../../../types/platform';

const TRANSLATABLE_KEYS: Array<{ key: keyof Omit<UiTextsConfig, 'contentTypeLabels' | 'customTextBlocks'>; label: string }> = [
  { key: 'loadingPlatform', label: 'جاري تحميل المنصة' },
  { key: 'loadingContent', label: 'جاري تحميل المحتوى' },
  { key: 'loadingSearch', label: 'جاري البحث' },
  { key: 'breadcrumbHome', label: 'الرئيسية' },
  { key: 'backToHomeLabel', label: 'العودة للرئيسية' },
  { key: 'viewAllDefaultLabel', label: 'عرض الكل' },
  { key: 'allItemsFilter', label: 'الكل' },
  { key: 'allTypesFilter', label: 'جميع الأنواع' },
  { key: 'sortNewest', label: 'الأحدث' },
  { key: 'sortOldest', label: 'الأقدم' },
  { key: 'sortViews', label: 'الأكثر مشاهدة' },
  { key: 'searchHeading', label: 'البحث في المنصة' },
  { key: 'searchAllTypes', label: 'كل الأنواع' },
  { key: 'searchEmptyMessage', label: 'رسالة عدم وجود نتائج بحث' },
  { key: 'shareLabel', label: 'مشاركة' },
  { key: 'copyLinkLabel', label: 'نسخ الرابط' },
  { key: 'copiedLinkLabel', label: 'تم نسخ الرابط' },
  { key: 'downloadVideoLabel', label: 'تحميل الفيديو' },
  { key: 'downloadImageLabel', label: 'تحميل الصورة' },
  { key: 'downloadAudioLabel', label: 'تحميل الصوت' },
  { key: 'downloadDocumentLabel', label: 'تحميل الوثيقة' },
  { key: 'footerLinksTitle', label: 'عنوان روابط التذييل' },
  { key: 'footerEmailLabel', label: 'البريد الإلكتروني' },
  { key: 'viewsSuffix', label: 'مشاهدة' },
];

export function AdminTranslations() {
  const { settings, saveCategory, setActiveSection, notify } = useAdmin();
  const [i18n, setI18n] = useState<SiteI18nConfig | null>(null);
  const [activeCode, setActiveCode] = useState('en');
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDir, setNewDir] = useState<'rtl' | 'ltr'>('ltr');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.i18n) {
      setI18n(structuredClone(settings.i18n));
      if (settings.i18n.languages.length > 0 && !settings.i18n.languages.some((l) => l.code === activeCode)) {
        setActiveCode(settings.i18n.languages[0].code);
      }
    }
  }, [settings]);

  if (!settings || !i18n) return null;

  const selectedLang = i18n.languages.find((l) => l.code === activeCode) || i18n.languages[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('i18n', i18n, 'تحديث حزم اللغات وترجمات الواجهة');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLanguage = () => {
    const code = newCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const label = newLabel.trim();
    if (!code || !label) {
      notify('يرجى إدخال رمز اللغة (مثل fr) واسمها.', 'error');
      return;
    }
    if (i18n.languages.some((l) => l.code === code)) {
      notify('هذه اللغة موجودة بالفعل.', 'error');
      return;
    }
    setI18n({
      ...i18n,
      languages: [...i18n.languages, { code, label, dir: newDir, overrides: {} }],
    });
    setActiveCode(code);
    setNewCode('');
    setNewLabel('');
  };

  const handleRemoveLang = (code: string) => {
    if (code === 'ar') {
      notify('لا يمكن حذف اللغة العربية الافتراضية لأنها المرجع الأصلي للمنصة.', 'error');
      return;
    }
    const next = i18n.languages.filter((l) => l.code !== code);
    setI18n({ ...i18n, languages: next });
    setActiveCode(next[0]?.code || 'ar');
  };

  const updateOverride = (key: string, val: string) => {
    if (!selectedLang) return;
    setI18n({
      ...i18n,
      languages: i18n.languages.map((l) =>
        l.code === selectedLang.code
          ? { ...l, overrides: { ...l.overrides, [key]: val } }
          : l
      ),
    });
  };

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        title="إدارة ترجمات الموقع واللغات المتعددة"
        subtitle="التحكم بتبديل لغة واجهة المنصة وتخصيص نصوص الأزرار والعناوين مع حماية النص العربي الأصلي"
        onSave={handleSave}
        saving={saving}
        actions={
          <button
            type="button"
            onClick={() => setActiveSection('subtitles')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
          >
            <Subtitles size={14} />
            <span>مسارات ترجمة الفيديوهات (VTT/SRT)</span>
          </button>
        }
      />

      <AdminCard title="إعدادات تعدد اللغات ومبدّل الواجهة">
        <div className="flex flex-wrap gap-6 mb-4">
          <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={i18n.enabled}
              onChange={(e) => setI18n({ ...i18n, enabled: e.target.checked })}
              className="accent-[#B08D45]"
            />
            <span>تفعيل دعم ترجمات الواجهة المتعددة</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={i18n.showSwitcher}
              onChange={(e) => setI18n({ ...i18n, showSwitcher: e.target.checked })}
              className="accent-[#B08D45]"
            />
            <span>إظهار مبدّل اللغة في الشريط العلوي</span>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">رمز اللغة (ISO)</label>
            <input
              type="text"
              dir="ltr"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="fr / tr / fa"
              className="w-28 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-mono bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الاسم الظاهر للزائر</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Français"
              className="w-40 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الاتجاه</label>
            <select
              value={newDir}
              onChange={(e) => setNewDir(e.target.value as 'rtl' | 'ltr')}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs bg-white"
            >
              <option value="ltr">من اليسار لليمين (LTR)</option>
              <option value="rtl">من اليمين لليسار (RTL)</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleAddLanguage}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
          >
            <Plus size={14} />
            <span>إضافة لغة</span>
          </button>
        </div>
      </AdminCard>

      {selectedLang && (
        <AdminCard title={`تحرير نصوص حزمة اللغة: ${selectedLang.label} (${selectedLang.code})`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {i18n.languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setActiveCode(lang.code)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    selectedLang.code === lang.code
                      ? 'bg-[#B08D45] text-white'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  <Globe2 size={13} />
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
            {selectedLang.code !== 'ar' && (
              <button
                type="button"
                onClick={() => handleRemoveLang(selectedLang.code)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs cursor-pointer"
              >
                <Trash2 size={13} />
                <span>حذف هذه اللغة</span>
              </button>
            )}
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Info size={15} className="shrink-0 mt-0.5" />
            <span>
              المترجم التحريري يحفظ النصوص يدوياً بدقة وموثوقية عالية دون تحريف النص العربي الأصلي. اترك أي حقل فارغاً لاستخدام النص العربي الافتراضي تلقائياً.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TRANSLATABLE_KEYS.map(({ key, label }) => {
              const arDefault = String(settings.uiTexts[key] ?? '');
              return (
                <div key={key} className="rounded-lg border border-neutral-200 p-2.5 bg-neutral-50/50">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-neutral-700">{label}</span>
                    <span className="text-neutral-400 truncate max-w-[160px]">{arDefault}</span>
                  </div>
                  <input
                    type="text"
                    dir={selectedLang.dir}
                    value={selectedLang.overrides[key] ?? ''}
                    onChange={(e) => updateOverride(key, e.target.value)}
                    placeholder={arDefault}
                    className="w-full rounded border border-neutral-200 px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
              );
            })}
          </div>
        </AdminCard>
      )}
    </div>
  );
}
