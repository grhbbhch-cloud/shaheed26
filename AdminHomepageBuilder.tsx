import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Feather,
  GripVertical,
  Monitor,
  Plus,
  RotateCcw,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { CONTENT_TYPE_LABELS } from '../../../lib/styleEngine';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type {
  AllSettings,
  CustomTextElementConfig,
  HomepageSectionConfig,
  UiTextsConfig,
} from '../../../types/platform';

const UI_TEXT_LABELS: Array<{ key: keyof Omit<UiTextsConfig, 'contentTypeLabels' | 'customTextBlocks'>; label: string }> = [
  { key: 'homeEmptySection', label: 'رسالة القسم الفارغ بالصفحة الرئيسية' },
  { key: 'viewAllDefaultLabel', label: 'نص زر "عرض كل المنشورات" الافتراضي' },
  { key: 'collectionEmptyMessage', label: 'رسالة الصفحة الفارغة في التصنيفات' },
  { key: 'breadcrumbHome', label: 'اسم "الرئيسية" في مسار التنقل' },
  { key: 'allItemsFilter', label: 'زر تصفية "الكل" في الصفحات' },
  { key: 'allTypesFilter', label: 'خيار "جميع الأنواع" في الصفحات' },
  { key: 'sortNewest', label: 'خيار الترتيب: الأحدث' },
  { key: 'sortOldest', label: 'خيار الترتيب: الأقدم' },
  { key: 'backToHomeLabel', label: 'نص زر العودة للرئيسية' },
  { key: 'searchHeading', label: 'عنوان صفحة البحث' },
  { key: 'searchAllTypes', label: 'خيار "كل الأنواع" في البحث' },
  { key: 'searchEmptyMessage', label: 'رسالة عدم وجود نتائج بحث' },
  { key: 'detailNotFound', label: 'رسالة عدم العثور على المادة' },
  { key: 'downloadVideoLabel', label: 'نص زر تحميل الفيديو' },
  { key: 'downloadImageLabel', label: 'نص زر تحميل الصورة' },
  { key: 'downloadAudioLabel', label: 'نص زر تحميل الصوت' },
  { key: 'downloadDocumentLabel', label: 'نص زر تحميل الوثيقة' },
  { key: 'documentAttachedLabel', label: 'عنوان صندوق الوثيقة المرفقة' },
  { key: 'shareLabel', label: 'نص زر المشاركة' },
  { key: 'copyLinkLabel', label: 'نص زر نسخ الرابط' },
  { key: 'copiedLinkLabel', label: 'نص تأكيد تم نسخ الرابط' },
  { key: 'openExternalLinkLabel', label: 'النص الافتراضي للرابط المرتبط' },
  { key: 'footerLinksTitle', label: 'عنوان قائمة روابط التذييل' },
  { key: 'footerEmailLabel', label: 'تسمية البريد الإلكتروني بالتذييل' },
  { key: 'jsonFeedLabel', label: 'نص رابط خلاصة JSON' },
  { key: 'loadingPlatform', label: 'نص التحميل العام للمنصة' },
  { key: 'loadingContent', label: 'نص تحميل المحتوى والمادة' },
  { key: 'loadingSearch', label: 'نص جاري البحث' },
  { key: 'fontScaleDecrease', label: 'زر تصغير الخط (أ-)' },
  { key: 'fontScaleNormal', label: 'زر الخط العادي' },
  { key: 'fontScaleIncrease', label: 'زر تكبير الخط (أ+)' },
];

export function AdminHomepageBuilder() {
  const { settings, previousSettings, pages, saveCategory, resetCategory, notify } = useAdmin();
  const [hp, setHp] = useState<AllSettings['homepage'] | null>(null);
  const [uiTexts, setUiTexts] = useState<UiTextsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<'builder' | 'custom-texts' | 'ui-texts'>('builder');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [dragSectionId, setDragSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.homepage) {
      setHp(structuredClone(settings.homepage));
      if (!selectedSectionId && settings.homepage.sections.length > 0) {
        setSelectedSectionId(settings.homepage.sections[0].id);
      }
    }
    if (settings?.uiTexts) {
      setUiTexts(structuredClone(settings.uiTexts));
    }
  }, [settings?.homepage, settings?.uiTexts]);

  if (!settings || !hp || !uiTexts) return null;

  const activeSections = hp.sections.filter((s) => !s.deleted).sort((a, b) => a.order - b.order);
  const deletedSections = hp.sections.filter((s) => s.deleted);
  const selectedSec = hp.sections.find((s) => s.id === selectedSectionId) || activeSections[0] || null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('homepage', hp, 'تحديث منشئ الصفحة الرئيسية');
      await saveCategory('uiTexts', uiTexts, 'تحديث النصوص والعبارات العامة');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setHp(structuredClone(settings.homepage));
    setUiTexts(structuredClone(settings.uiTexts));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prevHp = previousSettings.homepage as AllSettings['homepage'] | undefined;
    const prevUi = previousSettings.uiTexts as UiTextsConfig | undefined;
    if (!prevHp && !prevUi) return;
    if (prevHp) setHp(structuredClone(prevHp));
    if (prevUi) setUiTexts(structuredClone(prevUi));
    notify('تمت استعادة النسخة السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges =
    JSON.stringify(hp) !== JSON.stringify(settings.homepage) ||
    JSON.stringify(uiTexts) !== JSON.stringify(settings.uiTexts);
  const hasPreviousSnapshot = Boolean(previousSettings.homepage || previousSettings.uiTexts);

  const addSection = (type: HomepageSectionConfig['type']) => {
    const newSec: HomepageSectionConfig = {
      id: `sec-${Date.now()}`,
      type,
      title:
        type === 'banner' || type === 'linked-image'
          ? 'بانر إعلامي'
          : type === 'custom-text' || type === 'announcement'
            ? 'نص تعريفي جديد'
            : type === 'latest-poems'
              ? 'أحدث القصائد'
              : type === 'featured-poems'
                ? 'قصائد مختارة ومثبتة'
                : 'قسم محتوى جديد',
      subtitle: '',
      emptyMessage: '',
      showEmptyMessage: true,
      visible: true,
      deleted: false,
      showDesktop: true,
      showTablet: true,
      showMobile: true,
      order: hp.sections.length + 1,
      layout: 'grid',
      columns: 3,
      cardStyle: 'editorial',
      maxItems: 3,
      sourcePageId: null,
      sourceChildPageId: null,
      contentType:
        type === 'latest-videos' || type === 'featured-videos'
          ? 'video'
          : type === 'latest-images'
            ? 'image'
            : 'all',
      sortBy: 'newest',
      manualItemIds: [],
      bannerLinkEnabled: true,
      bannerOpenNewTab: true,
      backgroundColor: '#FFFFFF',
      viewAllLabel: 'عرض الكل',
      viewAllUrl: '/p/posts',
      showViewAll: true,
    };
    setHp({ ...hp, sections: [...hp.sections, newSec] });
    setSelectedSectionId(newSec.id);
  };

  const updateSection = (id: string, patch: Partial<HomepageSectionConfig>) => {
    setHp({
      ...hp,
      sections: hp.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const moveSection = (id: string, delta: number) => {
    const list = [...activeSections];
    const idx = list.findIndex((s) => s.id === id);
    const target = idx + delta;
    if (target < 0 || target >= list.length) return;
    const tmp = list[idx];
    list[idx] = list[target];
    list[target] = tmp;
    const reordered = list.map((s, i) => ({ ...s, order: i + 1 }));
    setHp({ ...hp, sections: [...reordered, ...deletedSections] });
  };

  const handleDropSection = (targetId: string) => {
    if (!dragSectionId || dragSectionId === targetId) {
      setDragSectionId(null);
      return;
    }
    const list = [...activeSections];
    const fromIdx = list.findIndex((s) => s.id === dragSectionId);
    const toIdx = list.findIndex((s) => s.id === targetId);
    setDragSectionId(null);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    const reordered = list.map((s, i) => ({ ...s, order: i + 1 }));
    setHp({ ...hp, sections: [...reordered, ...deletedSections] });
  };

  const duplicateSection = (sec: HomepageSectionConfig) => {
    const cloned: HomepageSectionConfig = {
      ...structuredClone(sec),
      id: `sec-${Date.now()}`,
      title: sec.title ? `${sec.title} (نسخة)` : 'قسم (نسخة)',
      order: activeSections.length + 1,
      deleted: false,
    };
    setHp({ ...hp, sections: [...hp.sections, cloned] });
    setSelectedSectionId(cloned.id);
    notify('تم تكرار القسم بنجاح');
  };

  const handleBannerUpload = async (file: File) => {
    if (!selectedSec) return;
    try {
      const res = await uploadFileInChunks(file);
      updateSection(selectedSec.id, { bannerImageUrl: res.media.public_url });
      notify('تم رفع صورة البانر');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع البانر', 'error');
    }
  };

  const addCustomTextBlock = () => {
    const blk: CustomTextElementConfig = {
      id: `txt-${Date.now()}`,
      location: 'hero-bottom',
      text: 'نص جديد قابل للتعديل بالكامل',
      visible: true,
      deleted: false,
      order: (uiTexts.customTextBlocks || []).length + 1,
      showDesktop: true,
      showTablet: true,
      showMobile: true,
      style: {
        fontFamily: 'Cairo',
        fontSizeDesktop: '16px',
        fontSizeTablet: '15px',
        fontSizeMobile: '14px',
        fontWeight: '600',
        lineHeight: '1.7',
        letterSpacing: '0px',
        textAlign: 'center',
        textDecoration: 'none',
        color: '#171717',
        opacity: 1,
        textShadow: 'none',
        gradient: {
          enabled: false,
          type: 'linear',
          angle: 135,
          direction: 'to left',
          position: 'center',
          stops: ['#B08D45', '#D4AF65'],
          opacity: 1,
          intensity: 1,
          animated: false,
          animationSpeed: 6,
          animationDirection: 'normal',
          loop: true,
        },
      },
      background: '#FFFFFF',
      borderColor: '#E5E5E5',
      borderWidth: 1,
      borderRadius: 10,
      shadow: 'none',
      padding: 16,
    };
    setUiTexts({ ...uiTexts, customTextBlocks: [...(uiTexts.customTextBlocks || []), blk] });
  };

  const updateCustomBlock = (id: string, patch: Partial<CustomTextElementConfig>) => {
    setUiTexts({
      ...uiTexts,
      customTextBlocks: (uiTexts.customTextBlocks || []).map((b) =>
        b.id === id ? { ...b, ...patch } : b
      ),
    });
  };

  return (
    <div>
      <AdminPanelHeader
        title="منشئ الصفحة الرئيسية ونصوص المنصة"
        subtitle="التحكم الكامل في قسم الواجهة (Hero)، الأقسام، رسائل الحالة الفارغة، الكتل النصية المخصصة، وكل جملة ظاهرة للزائر على الموقع."
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={async () => {
          await resetCategory('homepage');
          await resetCategory('uiTexts');
        }}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { id: 'builder', label: 'الواجهة وأقسام الرئيسية' },
          { id: 'ui-texts', label: 'تعديل كل نصوص وعبارات الموقع' },
          { id: 'custom-texts', label: `الكتل النصية المخصصة (${(uiTexts.customTextBlocks || []).filter((b) => !b.deleted).length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as any)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
              subTab === t.id
                ? 'bg-[#B08D45] text-white border-[#B08D45]'
                : 'bg-white text-neutral-700 border-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'builder' && (
        <div className="space-y-6">
          <AdminCard
            title="معاينة فورية للصفحة الرئيسية"
            subtitle="عرض حي لهيكل البطل والأقسام قبل الضغط على حفظ وتطبيق"
          >
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="inline-flex rounded-lg border border-neutral-300 bg-neutral-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                      previewDevice === 'desktop' ? 'bg-[#B08D45] text-white' : 'text-neutral-600'
                    }`}
                  >
                    <Monitor size={12} />
                    <span>سطح المكتب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('tablet')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                      previewDevice === 'tablet' ? 'bg-[#B08D45] text-white' : 'text-neutral-600'
                    }`}
                  >
                    <Tablet size={12} />
                    <span>الجهاز اللوحي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                      previewDevice === 'mobile' ? 'bg-[#B08D45] text-white' : 'text-neutral-600'
                    }`}
                  >
                    <Smartphone size={12} />
                    <span>الجوال</span>
                  </button>
                </div>
              </div>

              <div
                className={`rounded-xl border border-neutral-200 overflow-hidden bg-white mx-auto transition-all ${
                  previewDevice === 'mobile'
                    ? 'max-w-[360px]'
                    : previewDevice === 'tablet'
                      ? 'max-w-[740px]'
                      : 'w-full'
                }`}
              >
                {hp.hero.enabled && (
                  <div
                    className="p-5 bg-[#080808] text-white border-b border-neutral-800 bg-cover bg-center"
                    style={{
                      textAlign: hp.hero.alignment || 'center',
                      backgroundImage: hp.hero.customImageUrl ? `url(${hp.hero.customImageUrl})` : undefined,
                    }}
                  >
                    {hp.hero.showTitle && !hp.hero.titleDeleted && hp.hero.title && (
                      <h3 className="text-base font-extrabold">{hp.hero.title}</h3>
                    )}
                    {hp.hero.showSubtitle && !hp.hero.subtitleDeleted && hp.hero.subtitle && (
                      <p className="text-xs text-neutral-300 mt-1">{hp.hero.subtitle}</p>
                    )}
                    {hp.hero.showIntro && !hp.hero.introDeleted && hp.hero.introText && (
                      <p className="text-[11px] text-[#D4AF65] mt-1">{hp.hero.introText}</p>
                    )}
                  </div>
                )}

                <div className="p-3.5 space-y-3 bg-neutral-50/70">
                  {activeSections
                    .filter((s) =>
                      s.visible &&
                      (previewDevice === 'mobile'
                        ? s.showMobile !== false
                        : previewDevice === 'tablet'
                          ? s.showTablet !== false
                          : s.showDesktop !== false)
                    )
                    .map((sec) => (
                      <div
                        key={sec.id}
                        className="rounded-lg border border-neutral-200 p-3 space-y-2"
                        style={{ backgroundColor: sec.backgroundColor || '#FFFFFF' }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            {sec.title && <div className="text-xs font-extrabold text-neutral-900">{sec.title}</div>}
                            {sec.subtitle && <div className="text-[10px] text-neutral-500">{sec.subtitle}</div>}
                          </div>
                          {sec.showViewAll && sec.viewAllLabel && (
                            <span className="text-[10px] font-bold text-[#8C6A2F]">{sec.viewAllLabel}</span>
                          )}
                        </div>

                        {sec.type === 'banner' || sec.type === 'linked-image' ? (
                          <div className="rounded bg-neutral-100 border border-dashed border-neutral-300 h-14 flex items-center justify-center text-[11px] text-neutral-500">
                            {sec.bannerImageUrl ? 'صورة بانر مفعّلة' : 'مساحة بانر إعلامي'}
                          </div>
                        ) : sec.type === 'custom-text' || sec.type === 'announcement' ? (
                          <div className="text-[11px] text-neutral-700">{sec.customText || 'نص مخصص'}</div>
                        ) : (
                          <div
                            className={`grid gap-2 ${
                              previewDevice === 'mobile'
                                ? 'grid-cols-1'
                                : previewDevice === 'tablet'
                                  ? 'grid-cols-2'
                                  : sec.columns === 4
                                    ? 'grid-cols-4'
                                    : sec.columns === 2
                                      ? 'grid-cols-2'
                                      : sec.columns === 1
                                        ? 'grid-cols-1'
                                        : 'grid-cols-3'
                            }`}
                          >
                            {Array.from({ length: Math.min(sec.maxItems || 3, sec.columns || 3) }).map((_, i) => (
                              <div key={i} className="rounded border border-neutral-200 bg-white p-2 space-y-1">
                                <div className="h-8 rounded bg-neutral-100" />
                                <div className="h-2 w-3/4 rounded bg-neutral-200" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </AdminCard>

          {/* Hero Editor */}
          <AdminCard title="قسم الواجهة الرئيسي (Hero Section)">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-5">
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hp.hero.enabled}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, enabled: e.target.checked } })}
                    className="accent-[#B08D45]"
                  />
                  <span>إظهار قسم الواجهة الرئيسي</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hp.hero.showDesktop !== false}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, showDesktop: e.target.checked } })}
                    className="accent-[#B08D45]"
                  />
                  <span>سطح المكتب</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hp.hero.showTablet !== false}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, showTablet: e.target.checked } })}
                    className="accent-[#B08D45]"
                  />
                  <span>تابلت</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hp.hero.showMobile !== false}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, showMobile: e.target.checked } })}
                    className="accent-[#B08D45]"
                  />
                  <span>الجوال</span>
                </label>
              </div>

              {/* Hero Title Row with Hide / Soft-Delete / Restore */}
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800">العنوان الرئيسي (Hero Title)</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHp({ ...hp, hero: { ...hp.hero, showTitle: !hp.hero.showTitle } })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 bg-white text-[11px] font-semibold cursor-pointer"
                    >
                      {hp.hero.showTitle ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{hp.hero.showTitle ? 'ظاهر' : 'مخفي'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHp({ ...hp, hero: { ...hp.hero, titleDeleted: !hp.hero.titleDeleted } })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-white text-[11px] font-semibold text-red-600 cursor-pointer"
                    >
                      {hp.hero.titleDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                      <span>{hp.hero.titleDeleted ? 'استرجاع العنوان' : 'حذف العنوان'}</span>
                    </button>
                  </div>
                </div>
                {!hp.hero.titleDeleted && (
                  <input
                    type="text"
                    value={hp.hero.title}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, title: e.target.value } })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                  />
                )}
              </div>

              {/* Hero Subtitle Row with Hide / Soft-Delete / Restore */}
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800">الوصف الفرعي تحت العنوان</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHp({ ...hp, hero: { ...hp.hero, showSubtitle: !hp.hero.showSubtitle } })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 bg-white text-[11px] font-semibold cursor-pointer"
                    >
                      {hp.hero.showSubtitle ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{hp.hero.showSubtitle ? 'ظاهر' : 'مخفي'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHp({ ...hp, hero: { ...hp.hero, subtitleDeleted: !hp.hero.subtitleDeleted } })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-white text-[11px] font-semibold text-red-600 cursor-pointer"
                    >
                      {hp.hero.subtitleDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                      <span>{hp.hero.subtitleDeleted ? 'استرجاع الوصف' : 'حذف الوصف'}</span>
                    </button>
                  </div>
                </div>
                {!hp.hero.subtitleDeleted && (
                  <textarea
                    rows={2}
                    value={hp.hero.subtitle}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, subtitle: e.target.value } })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                  />
                )}
              </div>

              {/* Hero Intro Text */}
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800">النص التمهيدي الإضافي</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHp({ ...hp, hero: { ...hp.hero, showIntro: !hp.hero.showIntro } })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-300 bg-white text-[11px] font-semibold cursor-pointer"
                    >
                      {hp.hero.showIntro ? <Eye size={12} /> : <EyeOff size={12} />}
                      <span>{hp.hero.showIntro ? 'مفعّل' : 'مخفي'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHp({ ...hp, hero: { ...hp.hero, introDeleted: !hp.hero.introDeleted } })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-white text-[11px] font-semibold text-red-600 cursor-pointer"
                    >
                      {hp.hero.introDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                      <span>{hp.hero.introDeleted ? 'استرجاع' : 'حذف'}</span>
                    </button>
                  </div>
                </div>
                {hp.hero.showIntro && !hp.hero.introDeleted && (
                  <textarea
                    rows={2}
                    value={hp.hero.introText}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, introText: e.target.value } })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">المحاذاة</label>
                  <select
                    value={hp.hero.alignment}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, alignment: e.target.value as any } })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs"
                  >
                    <option value="right">يمين</option>
                    <option value="center">وسط</option>
                    <option value="left">يسار</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الحشوة العمودية (px)</label>
                  <input
                    type="number"
                    value={hp.hero.paddingY}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, paddingY: Number(e.target.value) } })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">أقل ارتفاع (px)</label>
                  <input
                    type="number"
                    value={hp.hero.minHeight}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, minHeight: Number(e.target.value) } })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">صورة خلفية البطل</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={hp.hero.customImageUrl}
                    onChange={(e) => setHp({ ...hp, hero: { ...hp.hero, customImageUrl: e.target.value } })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </AdminCard>

          {/* Sections List + Section Editor */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <AdminCard title={`أقسام الصفحة الرئيسية (${activeSections.length})`} className="xl:col-span-5">
              <div className="flex flex-wrap gap-1.5 mb-4">
                <button
                  type="button"
                  onClick={() => addSection('latest-content')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
                >
                  <Plus size={13} /> قسم محتوى
                </button>
                <button
                  type="button"
                  onClick={() => addSection('latest-videos')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
                >
                  <Plus size={13} /> فيديوهات
                </button>
                <button
                  type="button"
                  onClick={() => addSection('latest-poems')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
                >
                  <Feather size={13} /> قصائد الديوان
                </button>
                <button
                  type="button"
                  onClick={() => addSection('banner')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
                >
                  <Plus size={13} /> بانر / صورة مرتبطة
                </button>
                <button
                  type="button"
                  onClick={() => addSection('custom-text')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
                >
                  <Plus size={13} /> نص مخصص
                </button>
              </div>

              <div className="space-y-2">
                {activeSections.map((sec) => (
                  <div
                    key={sec.id}
                    draggable
                    onDragStart={() => setDragSectionId(sec.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropSection(sec.id)}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer ${
                      selectedSec?.id === sec.id
                        ? 'border-[#B08D45] bg-[#F7F4EC]/70'
                        : 'border-neutral-200 bg-white'
                    } ${dragSectionId === sec.id ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical size={13} className="text-neutral-300 shrink-0 cursor-grab" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900 truncate">{sec.title || sec.type}</div>
                        <div className="text-[11px] text-neutral-500">
                          الحد: {sec.maxItems} · {sec.visible ? 'ظاهر' : 'مخفي'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => duplicateSection(sec)} title="تكرار القسم" className="p-1 rounded hover:bg-neutral-200 cursor-pointer">
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => moveSection(sec.id, -1)} className="p-1 rounded hover:bg-neutral-200 cursor-pointer">
                        <ArrowUp size={13} />
                      </button>
                      <button type="button" onClick={() => moveSection(sec.id, 1)} className="p-1 rounded hover:bg-neutral-200 cursor-pointer">
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSection(sec.id, { visible: !sec.visible })}
                        className="p-1 rounded hover:bg-neutral-200 cursor-pointer"
                      >
                        {sec.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSection(sec.id, { deleted: true })}
                        className="p-1 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {deletedSections.length > 0 && (
                <div className="mt-4 pt-3 border-t border-neutral-200 space-y-2">
                  <div className="text-[11px] font-bold text-neutral-500">أقسام محذوفة (قابلة للاستعادة)</div>
                  {deletedSections.map((ds) => (
                    <div
                      key={ds.id}
                      className="flex items-center justify-between text-xs p-2 rounded bg-neutral-50 border border-neutral-200"
                    >
                      <span>{ds.title || ds.type}</span>
                      <button
                        type="button"
                        onClick={() => updateSection(ds.id, { deleted: false, visible: true })}
                        className="inline-flex items-center gap-1 text-[#8C6A2F] font-bold cursor-pointer"
                      >
                        <RotateCcw size={12} /> استعادة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>

            <AdminCard
              title={selectedSec ? `إعدادات القسم: ${selectedSec.title || selectedSec.type}` : 'تحرير القسم'}
              className="xl:col-span-7"
            >
              {selectedSec ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان القسم (اتركه فارغاً لإخفائه)</label>
                      <input
                        type="text"
                        value={selectedSec.title}
                        onChange={(e) => updateSection(selectedSec.id, { title: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الوصف الفرعي</label>
                      <input
                        type="text"
                        value={selectedSec.subtitle}
                        onChange={(e) => updateSection(selectedSec.id, { subtitle: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  {/* Section empty message editor + visibility */}
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-neutral-800">رسالة القسم عند خلوه من المواد</label>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSec.showEmptyMessage !== false}
                          onChange={(e) => updateSection(selectedSec.id, { showEmptyMessage: e.target.checked })}
                          className="accent-[#B08D45]"
                        />
                        <span>إظهار رسالة الخلو</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={selectedSec.emptyMessage ?? ''}
                      onChange={(e) => updateSection(selectedSec.id, { emptyMessage: e.target.value })}
                      placeholder={uiTexts.homeEmptySection || 'لا توجد مواد منشورة ضمن هذا القسم بعد.'}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs"
                    />
                  </div>

                  {/* Responsive Visibility */}
                  <div className="flex flex-wrap gap-5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSec.showDesktop !== false}
                        onChange={(e) => updateSection(selectedSec.id, { showDesktop: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>ظهور على سطح المكتب</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSec.showTablet !== false}
                        onChange={(e) => updateSection(selectedSec.id, { showTablet: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>ظهور على التابلت</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSec.showMobile !== false}
                        onChange={(e) => updateSection(selectedSec.id, { showMobile: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>ظهور على الجوال</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">عدد العناصر (Exact)</label>
                      <input
                        type="number"
                        min={1}
                        max={24}
                        value={selectedSec.maxItems}
                        onChange={(e) =>
                          updateSection(selectedSec.id, { maxItems: Math.max(1, Number(e.target.value)) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الأعمدة</label>
                      <select
                        value={selectedSec.columns}
                        onChange={(e) => updateSection(selectedSec.id, { columns: Number(e.target.value) })}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">نوع المحتوى</label>
                      <select
                        value={selectedSec.contentType}
                        onChange={(e) => updateSection(selectedSec.id, { contentType: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="all">الكل</option>
                        {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الترتيب</label>
                      <select
                        value={(selectedSec.sortBy as string) === 'views' ? 'newest' : selectedSec.sortBy}
                        onChange={(e) => updateSection(selectedSec.id, { sortBy: e.target.value as any })}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="newest">الأحدث</option>
                        <option value="oldest">الأقدم</option>
                        <option value="featured">المميز أولاً</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">مصدر الصفحة الرئيسية</label>
                      <select
                        value={selectedSec.sourcePageId ?? ''}
                        onChange={(e) =>
                          updateSection(selectedSec.id, {
                            sourcePageId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="">كل الصفحات</option>
                        {pages
                          .filter((p) => !p.parent_id && p.status !== 'deleted')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">مصدر الصفحة الفرعية</label>
                      <select
                        value={selectedSec.sourceChildPageId ?? ''}
                        onChange={(e) =>
                          updateSection(selectedSec.id, {
                            sourceChildPageId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="">الكل</option>
                        {pages
                          .filter((p) => p.parent_id !== null && p.status !== 'deleted')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {(selectedSec.type === 'banner' || selectedSec.type === 'linked-image') && (
                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-neutral-800">صورة ورابط البانر القابل للنقر</span>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#B08D45] text-white text-[11px] font-bold cursor-pointer">
                          <Upload size={12} />
                          <span>رفع صورة بانر</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleBannerUpload(f);
                            }}
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        dir="ltr"
                        value={selectedSec.bannerImageUrl || ''}
                        onChange={(e) => updateSection(selectedSec.id, { bannerImageUrl: e.target.value })}
                        placeholder="رابط صورة البانر"
                        className="w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSec.bannerLinkEnabled !== false}
                            onChange={(e) => updateSection(selectedSec.id, { bannerLinkEnabled: e.target.checked })}
                            className="accent-[#B08D45]"
                          />
                          <span>تفعيل النقر لفتح الرابط</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSec.bannerOpenNewTab !== false}
                            onChange={(e) => updateSection(selectedSec.id, { bannerOpenNewTab: e.target.checked })}
                            className="accent-[#B08D45]"
                          />
                          <span>فتح في تبويب جديد</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          value={selectedSec.bannerLinkUrl || ''}
                          onChange={(e) => updateSection(selectedSec.id, { bannerLinkUrl: e.target.value })}
                          placeholder="https://... أو /p/videos"
                          className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={selectedSec.bannerLinkLabel || ''}
                          onChange={(e) => updateSection(selectedSec.id, { bannerLinkLabel: e.target.value })}
                          placeholder="نص الرابط (اختياري)"
                          className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={selectedSec.bannerAlt || ''}
                          onChange={(e) => updateSection(selectedSec.id, { bannerAlt: e.target.value })}
                          placeholder="النص البديل (Alt)"
                          className="rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {(selectedSec.type === 'custom-text' || selectedSec.type === 'announcement') && (
                    <div>
                      <label className="block text-xs font-semibold mb-1">النص المخصص</label>
                      <textarea
                        rows={4}
                        value={selectedSec.customText || ''}
                        onChange={(e) => updateSection(selectedSec.id, { customText: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ColorField
                      label="خلفية القسم"
                      value={selectedSec.backgroundColor}
                      onChange={(v) => updateSection(selectedSec.id, { backgroundColor: v })}
                    />
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">نص زر "عرض الكل"</label>
                      <input
                        type="text"
                        value={selectedSec.viewAllLabel}
                        onChange={(e) => updateSection(selectedSec.id, { viewAllLabel: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">رابط زر "عرض الكل"</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={selectedSec.viewAllUrl}
                        onChange={(e) => updateSection(selectedSec.id, { viewAllUrl: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">العرض الأقصى للقسم</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={selectedSec.maxWidth || '1320px'}
                        onChange={(e) => updateSection(selectedSec.id, { maxWidth: e.target.value })}
                        placeholder="1320px"
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">أقل ارتفاع (px)</label>
                      <input
                        type="number"
                        min={0}
                        max={1200}
                        value={selectedSec.minHeight ?? 0}
                        onChange={(e) => updateSection(selectedSec.id, { minHeight: Number(e.target.value) })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الحشوة العمودية (px)</label>
                      <input
                        type="number"
                        min={0}
                        max={160}
                        value={selectedSec.paddingY ?? 0}
                        onChange={(e) => updateSection(selectedSec.id, { paddingY: Number(e.target.value) })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-xs text-neutral-500">اختر قسماً لتحريره.</p>
              )}
            </AdminCard>
          </div>
        </div>
      )}

      {/* SubTab 2: All Public Website UI Texts */}
      {subTab === 'ui-texts' && (
        <div className="space-y-6">
          <AdminCard
            title="تحرير جميع العبارات والجمل الظاهرة على الموقع العام"
            subtitle="عدّل أو استبدل أو امسح أي عبارة افتراضية في الرئيسية، صفحات التصنيفات، البحث، المشغل، وأزرار التحميل والمشاركة."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {UI_TEXT_LABELS.map((item) => (
                <div key={item.key}>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">{item.label}</label>
                  <input
                    type="text"
                    value={uiTexts[item.key] ?? ''}
                    onChange={(e) => setUiTexts({ ...uiTexts, [item.key]: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="تسميات أنواع المحتوى على البطاقات والفلاتر">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.keys(CONTENT_TYPE_LABELS).map((k) => (
                <div key={k}>
                  <label className="block text-[11px] font-mono text-neutral-500 mb-1">{k}</label>
                  <input
                    type="text"
                    value={uiTexts.contentTypeLabels?.[k] ?? CONTENT_TYPE_LABELS[k]}
                    onChange={(e) =>
                      setUiTexts({
                        ...uiTexts,
                        contentTypeLabels: {
                          ...(uiTexts.contentTypeLabels || CONTENT_TYPE_LABELS),
                          [k]: e.target.value,
                        },
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-semibold"
                  />
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      )}

      {/* SubTab 3: Custom Standalone Text Blocks */}
      {subTab === 'custom-texts' && (
        <AdminCard
          title="الكتل النصية المخصصة والموضعية"
          subtitle="أضف كتلاً نصية مستقلة أعلى أو أسفل الرئيسية أو التصنيفات أو التفاصيل أو التذييل مع تحكم كامل بالظهور والألوان والأجهزة."
        >
          <div className="mb-4">
            <button
              type="button"
              onClick={addCustomTextBlock}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
            >
              <Plus size={14} /> إضافة كتلة نصية جديدة
            </button>
          </div>

          <div className="space-y-4">
            {(uiTexts.customTextBlocks || []).map((blk) => (
              <div
                key={blk.id}
                className={`p-4 rounded-xl border space-y-3 ${
                  blk.deleted ? 'border-red-200 bg-red-50/40 opacity-70' : 'border-neutral-200 bg-neutral-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={blk.location}
                      onChange={(e) => updateCustomBlock(blk.id, { location: e.target.value as any })}
                      className="rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold"
                    >
                      <option value="hero-top">أعلى الواجهة الرئيسية</option>
                      <option value="hero-bottom">أسفل الواجهة الرئيسية</option>
                      <option value="home-after-sections">نهاية الصفحة الرئيسية</option>
                      <option value="collection-top">أعلى صفحات التصنيفات</option>
                      <option value="detail-top">أعلى صفحات التفاصيل</option>
                      <option value="footer-top">أعلى التذييل</option>
                    </select>
                    <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={blk.visible}
                        onChange={(e) => updateCustomBlock(blk.id, { visible: e.target.checked })}
                      />
                      <span>ظاهر</span>
                    </label>
                    <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={blk.showDesktop}
                        onChange={(e) => updateCustomBlock(blk.id, { showDesktop: e.target.checked })}
                      />
                      <span>سطح المكتب</span>
                    </label>
                    <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={blk.showMobile}
                        onChange={(e) => updateCustomBlock(blk.id, { showMobile: e.target.checked })}
                      />
                      <span>جوال</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateCustomBlock(blk.id, { deleted: !blk.deleted })}
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 cursor-pointer"
                  >
                    {blk.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                    <span>{blk.deleted ? 'استعادة' : 'حذف'}</span>
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={blk.text}
                  onChange={(e) => updateCustomBlock(blk.id, { text: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                />

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <ColorField
                    label="لون النص"
                    value={blk.style.color}
                    onChange={(c) => updateCustomBlock(blk.id, { style: { ...blk.style, color: c } })}
                  />
                  <ColorField
                    label="الخلفية"
                    value={blk.background}
                    onChange={(c) => updateCustomBlock(blk.id, { background: c })}
                  />
                  <ColorField
                    label="لون الإطار"
                    value={blk.borderColor}
                    onChange={(c) => updateCustomBlock(blk.id, { borderColor: c })}
                  />
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">حجم الخط</label>
                    <input
                      type="text"
                      value={blk.style.fontSizeDesktop}
                      onChange={(e) =>
                        updateCustomBlock(blk.id, {
                          style: { ...blk.style, fontSizeDesktop: e.target.value },
                        })
                      }
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">المحاذاة</label>
                    <select
                      value={blk.style.textAlign}
                      onChange={(e) =>
                        updateCustomBlock(blk.id, {
                          style: { ...blk.style, textAlign: e.target.value as any },
                        })
                      }
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="right">يمين</option>
                      <option value="center">وسط</option>
                      <option value="left">يسار</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
  );
}
